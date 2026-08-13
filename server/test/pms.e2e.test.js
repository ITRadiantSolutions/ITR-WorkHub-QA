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
const { default: Cycle } = await import("../src/models/Cycle.js");
const { default: KraDefinition } = await import("../src/models/KraDefinition.js");
const { default: KraAssignment } = await import("../src/models/KraAssignment.js");
const { default: Submission } = await import("../src/models/Submission.js");
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
    Cycle.deleteMany({}),
    KraDefinition.deleteMany({}),
    KraAssignment.deleteMany({}),
    Submission.deleteMany({}),
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

// Walks the same path a real HR admin + employee + manager would through the
// UI: build a KRA library entry, bundle it into a master template, open a
// review cycle, assign the template to an employee with weights, have the
// employee negotiate in an ad-hoc KRA of their own, fill in + submit their
// self-review, and have the manager rate it and close out the report.
describe("PMS end-to-end flow (real HTTP + real database)", () => {
  let hr;
  let manager;
  let employee;

  beforeEach(async () => {
    hr = await makeUser({ name: "Helen HR", roles: { timesheet: "employee", pms: "hr", tracker: "BUSINESS_USER" } });
    manager = await makeUser({ name: "Mike Manager", roles: { timesheet: "employee", pms: "manager", tracker: "BUSINESS_USER" } });
    employee = await makeUser({
      name: "Eve Employee",
      roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER" },
      managerId: manager._id,
    });
  });

  it("runs the full create → assign → self-review → manager-review flow", async () => {
    // 1. HR adds a KRA to the library.
    const libraryRes = await request(app)
      .post("/api/pms/kra/library")
      .set(authHeader(hr))
      .send({
        type: "functional",
        name: "Ship features on time",
        kpis: [
          { title: "Sprint commitments met", weight: 60 },
          { title: "Code review turnaround", weight: 40 },
        ],
      });
    expect(libraryRes.status).toBe(201);
    const libraryKraId = libraryRes.body.kras[0]._id;

    // 2. HR bundles it into a master template.
    const templateRes = await request(app)
      .post("/api/pms/kra/templates")
      .set(authHeader(hr))
      .send({
        name: "Engineer — Standard",
        kraRefs: [{ libraryType: "functional", kraId: libraryKraId }],
      });
    expect(templateRes.status).toBe(201);
    const templateId = templateRes.body._id;
    const templateKra = templateRes.body.kras[0];

    // An employee is not allowed to author templates.
    const blockedTemplate = await request(app)
      .post("/api/pms/kra/templates")
      .set(authHeader(employee))
      .send({ name: "Should not be allowed", kraRefs: [] });
    expect(blockedTemplate.status).toBe(403);

    // 3. HR opens a review cycle.
    const cycleRes = await request(app)
      .post("/api/pms/cycles")
      .set(authHeader(hr))
      .send({ name: "H1 2026 Review", type: "Half-Yearly", start: "2026-01-01", end: "2026-06-30" });
    expect(cycleRes.status).toBe(201);
    const cycleId = cycleRes.body._id;

    // 4. Manager assigns the template to the employee with a full 100% weight.
    const assignRes = await request(app)
      .post("/api/pms/kra/assignments/user")
      .set(authHeader(manager))
      .send({
        cycleId,
        templateId,
        userId: employee._id.toString(),
        kras: [{ defRef: templateKra._id, name: templateKra.name, type: templateKra.type, weight: 100, kpis: templateKra.kpis }],
      });
    expect(assignRes.status).toBe(201);
    const assignmentId = assignRes.body._id;
    const baseKraId = assignRes.body.kras[0]._id;

    // An outsider with no relation to this assignment can't see it.
    const outsider = await makeUser({ name: "Owen Outsider" });
    const blockedAssignment = await request(app).get(`/api/pms/kra/assignments/${assignmentId}`).set(authHeader(outsider));
    expect(blockedAssignment.status).toBe(403);

    // 5. Employee opens their submission (created on first access).
    const openRes = await request(app)
      .post(`/api/pms/submissions/from-assignment/${assignmentId}`)
      .set(authHeader(employee))
      .send({ managerId: manager._id.toString() });
    expect(openRes.status).toBe(200);
    expect(openRes.body.status).toBe("draft");
    const submissionId = openRes.body._id;

    // 6. Employee negotiates in a KRA of their own — the exact path that
    // used to crash with a placeholder id instead of a real Mongo ObjectId.
    const addKraRes = await request(app)
      .post(`/api/pms/kra/assignments/${assignmentId}/kras`)
      .set(authHeader(employee))
      .send({ name: "Mentor a new hire", type: "organizational", weight: 20, kpis: [{ title: "Onboarding sessions run", weight: 100 }] });
    expect(addKraRes.status).toBe(201);
    const employeeKraId = addKraRes.body.kra._id;
    expect(addKraRes.body.kra.isEmployeeAdded).toBe(true);

    // The new KRA is already reflected in the (already-created) submission.
    const afterAddKra = await Submission.findById(submissionId);
    expect(afterAddKra.kraResponses.map((r) => String(r.kraId))).toContain(employeeKraId);

    // Rebalance the base KRA's weight so the assignment totals 100% again.
    const rebalanceRes = await request(app)
      .put(`/api/pms/kra/assignments/${assignmentId}`)
      .set(authHeader(manager))
      .send({ kras: [{ ...templateKra, _id: baseKraId, weight: 80 }, addKraRes.body.kra] });
    expect(rebalanceRes.status).toBe(200);

    // 7. HR opens the employee response window before the employee can fill
    // anything in — saveResponses/employeeSubmit enforce this server-side.
    const windowRes = await request(app)
      .patch(`/api/pms/cycles/${cycleId}/employee-response`)
      .set(authHeader(hr))
      .send({
        enabled: true,
        durationDays: 7,
        expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        selectedUserIds: [employee._id.toString()],
      });
    expect(windowRes.status).toBe(200);

    // Employee fills in and saves their self-review.
    const saveRes = await request(app)
      .put(`/api/pms/submissions/${submissionId}/responses`)
      .set(authHeader(employee))
      .send({
        kraResponses: [
          { kraId: baseKraId, response: "Shipped every sprint commitment this half.", rating: 5 },
          { kraId: employeeKraId, response: "Ran three onboarding sessions.", rating: 4 },
        ],
      });
    expect(saveRes.status).toBe(200);
    expect(saveRes.body.kraResponses.find((r) => String(r.kraId) === String(baseKraId)).rating).toBe(5);

    // An unrelated user can't save responses on someone else's submission.
    const blockedSave = await request(app)
      .put(`/api/pms/submissions/${submissionId}/responses`)
      .set(authHeader(outsider))
      .send({ kraResponses: [] });
    expect(blockedSave.status).toBe(403);

    // 8. Employee submits for review.
    const submitRes = await request(app).post(`/api/pms/submissions/${submissionId}/employee-submit`).set(authHeader(employee));
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.status).toBe("employee_submitted");

    // Employee can no longer edit once submitted.
    const blockedResubmitEdit = await request(app)
      .put(`/api/pms/submissions/${submissionId}/responses`)
      .set(authHeader(employee))
      .send({ kraResponses: [{ kraId: baseKraId, response: "Trying to sneak an edit in", rating: 5 }] });
    expect(blockedResubmitEdit.status).toBe(409);

    // It now shows up in the manager's review queue.
    const queueRes = await request(app).get("/api/pms/submissions").set(authHeader(manager));
    expect(queueRes.status).toBe(200);
    expect(queueRes.body.map((s) => s._id)).toContain(submissionId);

    // 9. Manager rates each KRA.
    const reviewRes = await request(app)
      .post(`/api/pms/submissions/${submissionId}/manager-review`)
      .set(authHeader(manager))
      .send({
        kraReviews: [
          { kraId: baseKraId, managerResponse: "Strong delivery all half.", managerRating: 5 },
          { kraId: employeeKraId, managerResponse: "Great initiative on onboarding.", managerRating: 4 },
        ],
      });
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.status).toBe("manager_reviewed");
    expect(reviewRes.body.kraResponses.find((r) => String(r.kraId) === String(baseKraId)).managerRating).toBe(5);

    // Someone who isn't the assigned manager (and isn't HR) can't review it.
    const otherManager = await makeUser({ name: "Not This Employee's Manager", roles: { timesheet: "employee", pms: "manager", tracker: "BUSINESS_USER" } });
    const blockedReview = await request(app)
      .post(`/api/pms/submissions/${submissionId}/manager-review`)
      .set(authHeader(otherManager))
      .send({ kraReviews: [] });
    expect(blockedReview.status).toBe(403);

    // 10. Manager closes out the final report.
    const finalRes = await request(app)
      .patch(`/api/pms/submissions/${submissionId}/final-report`)
      .set(authHeader(manager))
      .send({
        managerSubmitted: true,
        managerOverallResponse: "Excellent half — exceeded expectations.",
        overallRating: 5,
        oneOnOneDate: "2026-07-05",
        oneOnOneComment: "Discussed promotion track.",
      });
    expect(finalRes.status).toBe(200);
    expect(finalRes.body.finalReport.managerSubmitted).toBe(true);
    expect(finalRes.body.finalReport.overallRating).toBe(5);

    // Before publishing, the employee can't see their own outcome yet — a
    // cycle's report is hidden from the employee until HR opts it in.
    const hiddenReportRes = await request(app).get(`/api/pms/reports/employee/${employee._id}`).set(authHeader(employee));
    expect(hiddenReportRes.body.find((s) => s._id === submissionId)).toBeUndefined();

    // 11. HR publishes the cycle's report to everyone.
    const visibilityRes = await request(app)
      .patch(`/api/pms/cycles/${cycleId}/report-visibility`)
      .set(authHeader(hr))
      .send({ mode: "all" });
    expect(visibilityRes.status).toBe(200);

    // Now the employee's own report reflects everything end to end.
    const myReportRes = await request(app).get(`/api/pms/reports/employee/${employee._id}`).set(authHeader(employee));
    expect(myReportRes.status).toBe(200);
    const finished = myReportRes.body.find((s) => s._id === submissionId);
    expect(finished.status).toBe("manager_reviewed");
    expect(finished.finalReport.overallRating).toBe(5);

    // And HR's cycle-level report picks it up too.
    const cycleReportRes = await request(app).get("/api/pms/reports/cycle").query({ cycleId }).set(authHeader(hr));
    expect(cycleReportRes.status).toBe(200);
    expect(cycleReportRes.body.some((row) => row.Employee === "Eve Employee" && row.OverallRating === 5)).toBe(true);
  });

  it("enforces the cycle's employee response window server-side: viewable but not fillable before HR opens it, fillable after, through to manager review", async () => {
    // 1. HR creates a KRA in the library.
    const libraryRes = await request(app)
      .post("/api/pms/kra/library")
      .set(authHeader(hr))
      .send({ type: "functional", name: "Reduce bug backlog", kpis: [{ title: "Bugs closed", weight: 100 }] });
    expect(libraryRes.status).toBe(201);
    const libraryKra = libraryRes.body.kras[0];

    // 2. HR opens a review cycle — response window starts disabled by default.
    const cycleRes = await request(app)
      .post("/api/pms/cycles")
      .set(authHeader(hr))
      .send({ name: "Q3 2026 Review", type: "Quarterly", start: "2026-07-01", end: "2026-09-30" });
    expect(cycleRes.status).toBe(201);
    const cycleId = cycleRes.body._id;
    expect(cycleRes.body.employeeResponse.enabled).toBe(false);

    // 3. HR assigns the KRA directly to the employee.
    const assignRes = await request(app)
      .post("/api/pms/kra/assignments/user")
      .set(authHeader(hr))
      .send({
        cycleId,
        userId: employee._id.toString(),
        kras: [{ name: libraryKra.name, type: libraryKra.type, weight: 100, kpis: libraryKra.kpis }],
      });
    expect(assignRes.status).toBe(201);
    const assignmentId = assignRes.body._id;
    const kraId = assignRes.body.kras[0]._id;

    // 4. Employee CAN view their assignment before the window opens — HR
    // hasn't disabled visibility, only the ability to respond.
    const viewRes = await request(app).get(`/api/pms/kra/assignments/${assignmentId}`).set(authHeader(employee));
    expect(viewRes.status).toBe(200);

    const openRes = await request(app)
      .post(`/api/pms/submissions/from-assignment/${assignmentId}`)
      .set(authHeader(employee))
      .send({ managerId: manager._id.toString() });
    expect(openRes.status).toBe(200);
    const submissionId = openRes.body._id;

    // 5. Window is still closed — the employee must NOT be able to save or
    // submit responses via a direct API call, even though the status
    // ("draft") is otherwise employee-editable.
    const blockedFillRes = await request(app)
      .put(`/api/pms/submissions/${submissionId}/responses`)
      .set(authHeader(employee))
      .send({ kraResponses: [{ kraId, response: "Trying to fill before the window opens", rating: 4 }] });
    expect(blockedFillRes.status).toBe(409);

    const blockedSubmitRes = await request(app).post(`/api/pms/submissions/${submissionId}/employee-submit`).set(authHeader(employee));
    expect(blockedSubmitRes.status).toBe(409);

    // 6. HR opens the employee response window, scoped to this employee.
    const toggleRes = await request(app)
      .patch(`/api/pms/cycles/${cycleId}/employee-response`)
      .set(authHeader(hr))
      .send({
        enabled: true,
        durationDays: 7,
        expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        selectedUserIds: [employee._id.toString()],
      });
    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.employeeResponse.enabled).toBe(true);

    // A different employee, not in selectedUserIds, is still blocked even
    // with the window enabled cycle-wide.
    const otherEmployee = await makeUser({ name: "Not Selected", managerId: manager._id });
    const otherAssignRes = await request(app)
      .post("/api/pms/kra/assignments/user")
      .set(authHeader(hr))
      .send({ cycleId, userId: otherEmployee._id.toString(), kras: [{ name: libraryKra.name, type: libraryKra.type, weight: 100, kpis: [] }] });
    const otherOpenRes = await request(app)
      .post(`/api/pms/submissions/from-assignment/${otherAssignRes.body._id}`)
      .set(authHeader(otherEmployee))
      .send({ managerId: manager._id.toString() });
    const otherKraId = otherAssignRes.body.kras[0]._id;
    const stillBlockedRes = await request(app)
      .put(`/api/pms/submissions/${otherOpenRes.body._id}/responses`)
      .set(authHeader(otherEmployee))
      .send({ kraResponses: [{ kraId: otherKraId, response: "Not selected for this window", rating: 3 }] });
    expect(stillBlockedRes.status).toBe(409);

    // 7. Now the selected employee can fill in and save.
    const fillRes = await request(app)
      .put(`/api/pms/submissions/${submissionId}/responses`)
      .set(authHeader(employee))
      .send({ kraResponses: [{ kraId, response: "Closed 40 bugs this quarter, cleared the backlog.", rating: 5 }] });
    expect(fillRes.status).toBe(200);
    expect(fillRes.body.kraResponses.find((r) => String(r.kraId) === String(kraId)).rating).toBe(5);

    // 8. And submit for review.
    const submitRes = await request(app).post(`/api/pms/submissions/${submissionId}/employee-submit`).set(authHeader(employee));
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.status).toBe("employee_submitted");

    // 9. Manager reviews it end to end.
    const reviewRes = await request(app)
      .post(`/api/pms/submissions/${submissionId}/manager-review`)
      .set(authHeader(manager))
      .send({ kraReviews: [{ kraId, managerResponse: "Big backlog reduction, great focus.", managerRating: 5 }] });
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.status).toBe("manager_reviewed");
  });

  it("lists an employee with no submission as a non-submitter for the cycle", async () => {
    const cycleRes = await request(app)
      .post("/api/pms/cycles")
      .set(authHeader(hr))
      .send({ name: "H1 2026 Review", start: "2026-01-01", end: "2026-06-30" });
    const cycleId = cycleRes.body._id;

    const res = await request(app).get("/api/pms/reports/non-submitters").query({ cycleId }).set(authHeader(hr));
    expect(res.status).toBe(200);
    expect(res.body.map((u) => u.id)).toContain(employee._id.toString());
  });
});
