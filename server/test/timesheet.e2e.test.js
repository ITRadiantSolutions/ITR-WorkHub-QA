import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

// Env vars must be in place before app.js (and anything it imports) reads
// them, so this runs before any local imports below.
process.env.JWT_SECRET = "test-secret";
process.env.CLIENT_URL = "http://localhost:5173";

const { default: app } = await import("../src/app.js");
const { default: User } = await import("../src/models/User.js");
const { default: Project } = await import("../src/models/Project.js");
const { default: Timesheet } = await import("../src/models/Timesheet.js");
const { default: CompanyHoliday } = await import("../src/models/CompanyHoliday.js");
const { signToken } = await import("../src/utils/jwt.js");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Project.deleteMany({}),
    Timesheet.deleteMany({}),
    CompanyHoliday.deleteMany({}),
  ]);
});

const makeUser = (overrides = {}) =>
  User.create({
    name: "Test User",
    email: `user-${new mongoose.Types.ObjectId()}@example.com`,
    password: "password123",
    approvalStatus: "Approved",
    roles: { timesheet: "employee", pms: "employee", tracker: "DEVELOPER" },
    ...overrides,
  });

const authHeader = (user) => ({ Authorization: `Bearer ${signToken(user)}` });

const pad2 = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
const addDays = (date, n) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + n));

// Monday (UTC) of the week `weeksOffset` full weeks away from this week —
// negative goes into the future, positive into the past. An offset of 2+ in
// the past guarantees the week has already "ended" no matter what day this
// suite happens to run on, which submitTimesheet requires.
const mondayOfWeek = (weeksOffset) => {
  const now = new Date();
  const dow = now.getUTCDay(); // 0 = Sunday
  const diffToMonday = (dow + 6) % 7;
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday));
  return new Date(thisMonday.getTime() - weeksOffset * 7 * 24 * 60 * 60 * 1000);
};

const HOUR = 3600;

// One row: `hoursPerDay` hours Mon-Fri on `projectId`, weekend left at 0.
// `nsaDays` (0=Mon..4=Fri) marks which of those days also claims NSA.
const weekdayRow = (projectId, hoursPerDay, { nsaDays = [] } = {}) => {
  const secs = Array(7).fill(0);
  const nsa = Array(7).fill(false);
  for (let d = 0; d < 5; d++) {
    secs[d] = hoursPerDay * HOUR;
    if (nsaDays.includes(d)) nsa[d] = true;
  }
  return { projectId, task: "Development", secs, nsa, comment: "" };
};

const saveWeek = (user, weekStart, rows) =>
  request(app)
    .post("/api/timesheets/save")
    .set(authHeader(user))
    .send({ weekStart: isoDate(weekStart), weekEnd: isoDate(addDays(weekStart, 6)), rows });

const submitWeek = (user, id, managerId, extra = {}) =>
  request(app)
    .post(`/api/timesheets/${id}/submit`)
    .set(authHeader(user))
    .send({ managerId: managerId.toString(), ...extra });

const managerDecide = (manager, id, action, comment) =>
  request(app)
    .post(`/api/timesheets/${id}/${action}`)
    .set(authHeader(manager))
    .send({ comment });

// Walks the same path a real employee + manager + HR would through TimeFlow:
// project team assignment, company holidays, the daily/weekly hour caps,
// NSA claims, weekend locking, and three consecutive weeks each exercising a
// different manager decision (approve / reject+resubmit / needs_edit+resubmit).
describe("Timesheet end-to-end flow (real HTTP + real database)", () => {
  let hr, manager, employee, project;

  beforeEach(async () => {
    hr = await makeUser({ name: "Helen HR", roles: { timesheet: "hr", pms: "employee", tracker: "BUSINESS_USER" } });
    manager = await makeUser({ name: "Mike Manager", roles: { timesheet: "manager", pms: "employee", tracker: "PM" } });
    employee = await makeUser({
      name: "Eve Employee",
      roles: { timesheet: "employee", pms: "employee", tracker: "DEVELOPER" },
      managerId: manager._id,
    });

    const projRes = await request(app)
      .post("/api/projects")
      .set(authHeader(manager))
      .send({ name: "Apollo", projectLead: manager._id.toString(), teamMembers: [employee._id.toString()] });
    expect(projRes.status).toBe(201);
    project = projRes.body;
  });

  it("blocks logging hours against a project the employee isn't a member of", async () => {
    const outsider = await makeUser({ name: "Owen Outsider" });
    const res = await saveWeek(outsider, mondayOfWeek(4), [weekdayRow(project._id, 8)]);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not assigned to one of the selected projects/i);
  });

  it("enforces the 8h/day cap and blocks weekend hours", async () => {
    const weekStart = mondayOfWeek(4);

    const overDay = await saveWeek(employee, weekStart, [weekdayRow(project._id, 9)]);
    expect(overDay.status).toBe(400);
    expect(overDay.body.message).toMatch(/8-hour daily limit/i);

    // 6h/day Mon-Fri (30h, under both caps) + 2h logged on Saturday — isolates
    // the weekend rule from the daily/weekly caps.
    const weekendRow = weekdayRow(project._id, 6);
    weekendRow.secs[5] = 2 * HOUR;
    const weekend = await saveWeek(employee, weekStart, [weekendRow]);
    expect(weekend.status).toBe(400);
    expect(weekend.body.message).toMatch(/saturday and sunday cannot have logged hours/i);
  });

  it("validates NSA claims: blocked on weekends, blocked without hours that day, blocked for future dates, otherwise saved", async () => {
    const weekStart = mondayOfWeek(4);

    // NSA claimed on Saturday with no hours logged that day (isolates the
    // weekend-NSA rule from the "no logged hours" rule below).
    const weekendNsaRow = weekdayRow(project._id, 6);
    weekendNsaRow.nsa[5] = true;
    const weekendNsa = await saveWeek(employee, weekStart, [weekendNsaRow]);
    expect(weekendNsa.status).toBe(400);
    expect(weekendNsa.body.message).toMatch(/nsa cannot be claimed for saturday or sunday/i);

    // NSA claimed on a weekday with zero hours logged that day.
    const noHoursRow = weekdayRow(project._id, 8);
    noHoursRow.secs[3] = 0;
    noHoursRow.nsa[3] = true;
    const noHours = await saveWeek(employee, weekStart, [noHoursRow]);
    expect(noHours.status).toBe(400);
    expect(noHours.body.message).toMatch(/no hours logged/i);

    // NSA claimed for a date that hasn't happened yet — use next week so
    // every weekday in it is guaranteed to be in the future.
    const futureWeek = mondayOfWeek(-1);
    const futureRow = weekdayRow(project._id, 8, { nsaDays: [0] });
    const future = await saveWeek(employee, futureWeek, [futureRow]);
    expect(future.status).toBe(400);
    expect(future.body.message).toMatch(/future date/i);

    // A valid same-day NSA claim saves and round-trips.
    const validRow = weekdayRow(project._id, 8, { nsaDays: [4] });
    const saved = await saveWeek(employee, weekStart, [validRow]);
    expect(saved.status).toBe(200);
    expect(saved.body.rows[0].nsa[4]).toBe(true);
  });

  it("blocks hours and NSA claims on a declared company holiday", async () => {
    const weekStart = mondayOfWeek(4);
    const wednesday = isoDate(addDays(weekStart, 2));

    const holidayRes = await request(app)
      .post("/api/company-holidays")
      .set(authHeader(hr))
      .send({ date: wednesday, label: "Company Day Off" });
    expect(holidayRes.status).toBe(201);

    // A manager (not HR) can't declare a company-wide holiday.
    const blockedHoliday = await request(app)
      .post("/api/company-holidays")
      .set(authHeader(manager))
      .send({ date: isoDate(addDays(weekStart, 3)) });
    expect(blockedHoliday.status).toBe(403);

    const res = await saveWeek(employee, weekStart, [weekdayRow(project._id, 8)]);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(new RegExp(`${wednesday}.*declared holiday`));
  });

  it("won't let an employee submit a week that hasn't ended yet", async () => {
    const draft = await saveWeek(employee, mondayOfWeek(0), [weekdayRow(project._id, 8)]);
    expect(draft.status).toBe(200);

    const submit = await submitWeek(employee, draft.body._id, manager._id);
    expect(submit.status).toBe(400);
    expect(submit.body.message).toMatch(/hasn't ended yet/i);
  });

  it("rejects submitting to yourself or to a non-manager user", async () => {
    const weekStart = mondayOfWeek(4);
    const draft = await saveWeek(employee, weekStart, [weekdayRow(project._id, 8)]);

    const toSelf = await submitWeek(employee, draft.body._id, employee._id);
    expect(toSelf.status).toBe(400);
    expect(toSelf.body.message).toMatch(/cannot submit a timesheet to yourself/i);

    const otherEmployee = await makeUser({ name: "Not A Manager" });
    const toNonManager = await submitWeek(employee, draft.body._id, otherEmployee._id);
    expect(toNonManager.status).toBe(400);
    expect(toNonManager.body.message).toMatch(/not a valid manager/i);
  });

  it("runs three consecutive weeks through submit → manager decision → resubmit: approve, reject+resubmit, needs_edit+resubmit", async () => {
    // Week 1: straightforward submit → approve.
    const week1Start = mondayOfWeek(4);
    const draft1 = await saveWeek(employee, week1Start, [weekdayRow(project._id, 8, { nsaDays: [4] })]);
    expect(draft1.status).toBe(200);
    expect(draft1.body.status).toBe("draft");

    const submit1 = await submitWeek(employee, draft1.body._id, manager._id);
    expect(submit1.status).toBe(200);
    expect(submit1.body.status).toBe("submitted");

    // Shows up in the manager's review queue.
    const queue1 = await request(app).get("/api/timesheets/manager?status=submitted").set(authHeader(manager));
    expect(queue1.status).toBe(200);
    expect(queue1.body.map((t) => t._id)).toContain(submit1.body._id);

    const approve1 = await managerDecide(manager, submit1.body._id, "approve", "Looks good");
    expect(approve1.status).toBe(200);
    expect(approve1.body.status).toBe("approved");

    // Employee can no longer edit an approved week.
    const blockedEdit = await saveWeek(employee, week1Start, [weekdayRow(project._id, 8)]);
    expect(blockedEdit.status).toBe(409);

    // Week 2: submit → manager rejects → employee edits and resubmits → approve.
    const week2Start = mondayOfWeek(3);
    const draft2 = await saveWeek(employee, week2Start, [weekdayRow(project._id, 6)]);
    const submit2 = await submitWeek(employee, draft2.body._id, manager._id);
    expect(submit2.status).toBe(200);

    const reject2 = await managerDecide(manager, submit2.body._id, "reject", "Please account for all 40 hours");
    expect(reject2.status).toBe(200);
    expect(reject2.body.status).toBe("rejected");

    const edit2 = await saveWeek(employee, week2Start, [weekdayRow(project._id, 8)]);
    expect(edit2.status).toBe(200);
    expect(edit2.body.status).toBe("draft");

    // Even though saveDraft reset status to "draft" on that edit, submit
    // still recognizes this as a resubmission (via history, not status) and
    // carries the employee's resubmitComment through.
    const resubmit2 = await submitWeek(employee, edit2.body._id, manager._id, {
      resubmitComment: "Filled in the missing hours",
    });
    expect(resubmit2.status).toBe(200);
    expect(resubmit2.body.status).toBe("submitted");
    expect(resubmit2.body.history.at(-1).comment).toBe("Filled in the missing hours");

    const approve2 = await managerDecide(manager, resubmit2.body._id, "approve");
    expect(approve2.status).toBe(200);
    expect(approve2.body.status).toBe("approved");

    // Week 3: submit → manager sends it back for edits → employee fixes and
    // resubmits → approve.
    const week3Start = mondayOfWeek(2);
    const draft3 = await saveWeek(employee, week3Start, [weekdayRow(project._id, 8)]);
    const submit3 = await submitWeek(employee, draft3.body._id, manager._id);
    expect(submit3.status).toBe(200);

    const needsEdit3 = await managerDecide(manager, submit3.body._id, "needs_edit", "Split hours across the right projects");
    expect(needsEdit3.status).toBe(200);
    expect(needsEdit3.body.status).toBe("needs_edit");

    // Resubmitting directly from "needs_edit" (no edit in between) is where
    // the auto-generated "Resubmitted after…" history comment actually kicks in.
    const directResubmit3 = await submitWeek(employee, needsEdit3.body._id, manager._id);
    expect(directResubmit3.status).toBe(200);
    expect(directResubmit3.body.status).toBe("submitted");
    expect(directResubmit3.body.history.at(-1).comment).toBe("Resubmitted after needs_edit");

    // Manager sends it back again so we can also exercise the normal
    // edit-then-resubmit path before final approval.
    const needsEdit3b = await managerDecide(manager, directResubmit3.body._id, "needs_edit", "One more pass please");
    expect(needsEdit3b.status).toBe(200);

    const edit3 = await saveWeek(employee, week3Start, [weekdayRow(project._id, 8)]);
    expect(edit3.status).toBe(200);

    const resubmit3 = await submitWeek(employee, edit3.body._id, manager._id);
    expect(resubmit3.status).toBe(200);

    const approve3 = await managerDecide(manager, resubmit3.body._id, "approve");
    expect(approve3.status).toBe(200);
    expect(approve3.body.status).toBe("approved");

    // HR can pull any employee's full history...
    const hrList = await request(app).get(`/api/timesheets?userId=${employee._id}`).set(authHeader(hr));
    expect(hrList.status).toBe(200);
    expect(hrList.body.filter((t) => t.status === "approved").length).toBe(3);

    // ...and the manager's status summary reflects the final tally.
    const statusSummary = await request(app).get("/api/timesheets/manager/status").set(authHeader(manager));
    expect(statusSummary.status).toBe(200);
    expect(statusSummary.body.approved).toBe(3);

    // A manager with no relationship to this employee can't act on any of
    // these timesheets, regardless of their current status.
    const otherManager = await makeUser({ name: "Not This Employee's Manager", roles: { timesheet: "manager" } });
    const blockedAction = await managerDecide(otherManager, draft1.body._id, "approve");
    expect(blockedAction.status).toBe(403);
  });
});
