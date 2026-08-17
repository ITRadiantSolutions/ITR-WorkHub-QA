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
const { default: JobRequest } = await import("../src/models/JobRequest.js");
const { default: JobPost } = await import("../src/models/JobPost.js");
const { default: Candidate } = await import("../src/models/Candidate.js");
const { default: Referral } = await import("../src/models/Referral.js");
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
    JobRequest.deleteMany({}),
    JobPost.deleteMany({}),
    Candidate.deleteMany({}),
    Referral.deleteMany({}),
  ]);
});

const makeUser = (overrides = {}) =>
  User.create({
    name: "Test User",
    email: `user-${new mongoose.Types.ObjectId()}@example.com`,
    password: "password123",
    approvalStatus: "Approved",
    roles: { timesheet: "employee", pms: "employee", tracker: "DEVELOPER", hrms: "employee" },
    ...overrides,
  });

const authHeader = (user) => ({ Authorization: `Bearer ${signToken(user)}` });

const validCandidate = (overrides = {}) => ({
  name: "Charlie Candidate",
  email: "charlie.candidate@example.com",
  phone: "9876543210",
  experienceYears: 3,
  currentCompany: "Old Co",
  skills: ["JavaScript", "React"],
  ...overrides,
});

// Walks the same path a real manager + HR + employee would through HRMS
// recruitment: a manager raises a job request, HR asks a clarification and
// eventually approves + publishes it, an employee refers a candidate for the
// resulting job post, and HR moves that referral through the hiring pipeline.
describe("HRMS recruitment end-to-end flow (real HTTP + real database)", () => {
  let hr, manager, employee;

  beforeEach(async () => {
    hr = await makeUser({ name: "Helen HR", roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", hrms: "hr" } });
    manager = await makeUser({ name: "Mike Manager", roles: { timesheet: "employee", pms: "employee", tracker: "PM", hrms: "manager" } });
    employee = await makeUser({
      name: "Eve Employee",
      roles: { timesheet: "employee", pms: "employee", tracker: "DEVELOPER", hrms: "employee" },
      managerId: manager._id,
    });
  });

  it("only a manager can raise a job request — HR and employee are blocked from creating one directly", async () => {
    const managerCreate = await request(app)
      .post("/api/hrms/job-requests")
      .set(authHeader(manager))
      .send({ title: "Senior Backend Engineer", department: "Engineering", positions: 2 });
    expect(managerCreate.status).toBe(201);
    expect(managerCreate.body.status).toBe("submitted");

    const employeeCreate = await request(app)
      .post("/api/hrms/job-requests")
      .set(authHeader(employee))
      .send({ title: "Should not be allowed" });
    expect(employeeCreate.status).toBe(403);

    const hrCreate = await request(app)
      .post("/api/hrms/job-requests")
      .set(authHeader(hr))
      .send({ title: "HR should not create requests directly" });
    expect(hrCreate.status).toBe(403);
  });

  it("HR can reject a job request with a reason, and a rejected request can't be published", async () => {
    const create = await request(app)
      .post("/api/hrms/job-requests")
      .set(authHeader(manager))
      .send({ title: "QA Engineer" });
    const requestId = create.body._id;

    const reject = await request(app)
      .post(`/api/hrms/job-requests/${requestId}/review`)
      .set(authHeader(hr))
      .send({ action: "reject", rejectionReason: "Headcount frozen this quarter" });
    expect(reject.status).toBe(200);
    expect(reject.body.status).toBe("rejected");
    expect(reject.body.rejectionReason).toBe("Headcount frozen this quarter");

    const publish = await request(app).post(`/api/hrms/job-requests/${requestId}/publish`).set(authHeader(hr));
    expect(publish.status).toBe(409);
  });

  it("runs a job request through clarification → approval → publish, then the resulting job post through referral → continuous status changes", async () => {
    // 1. Manager raises the request.
    const create = await request(app)
      .post("/api/hrms/job-requests")
      .set(authHeader(manager))
      .send({
        title: "Senior Backend Engineer",
        department: "Engineering",
        positions: 2,
        skillsRequired: ["Node.js", "MongoDB"],
        priority: "High",
      });
    expect(create.status).toBe(201);
    const requestId = create.body._id;

    // 2. HR asks a clarification before reviewing further.
    const clarify = await request(app)
      .post(`/api/hrms/job-requests/${requestId}/clarification`)
      .set(authHeader(hr))
      .send({ question: "Is this backfill or net-new headcount?" });
    expect(clarify.status).toBe(200);
    expect(clarify.body.status).toBe("clarification_required");

    // A manager who isn't HR can't ask a clarification.
    const blockedClarify = await request(app)
      .post(`/api/hrms/job-requests/${requestId}/clarification`)
      .set(authHeader(manager))
      .send({ question: "Not allowed" });
    expect(blockedClarify.status).toBe(403);

    // Someone else's job request can't be responded to by another manager.
    const otherManager = await makeUser({ name: "Other Manager", roles: { hrms: "manager" } });
    const blockedRespond = await request(app)
      .post(`/api/hrms/job-requests/${requestId}/clarification/respond`)
      .set(authHeader(otherManager))
      .send({ response: "Trying to answer someone else's request" });
    expect(blockedRespond.status).toBe(403);

    // 3. While clarification is pending, the requesting manager can still
    // edit the request — doing so bumps it back to under_review.
    const edit = await request(app)
      .put(`/api/hrms/job-requests/${requestId}`)
      .set(authHeader(manager))
      .send({ positions: 3 });
    expect(edit.status).toBe(200);
    expect(edit.body.positions).toBe(3);
    expect(edit.body.status).toBe("under_review");

    // Editing is no longer allowed once it's back under_review.
    const blockedEdit = await request(app)
      .put(`/api/hrms/job-requests/${requestId}`)
      .set(authHeader(manager))
      .send({ positions: 4 });
    expect(blockedEdit.status).toBe(409);

    // The manager can still answer the (still-open) clarification itself.
    const respond = await request(app)
      .post(`/api/hrms/job-requests/${requestId}/clarification/respond`)
      .set(authHeader(manager))
      .send({ response: "Net-new — the team is growing." });
    expect(respond.status).toBe(200);
    expect(respond.body.status).toBe("under_review");

    const afterRespond = await request(app).get(`/api/hrms/job-requests/${requestId}`).set(authHeader(hr));
    expect(afterRespond.body.clarifications[0].response).toBe("Net-new — the team is growing.");

    // An unrelated employee can't view this manager's job request.
    const blockedView = await request(app).get(`/api/hrms/job-requests/${requestId}`).set(authHeader(employee));
    expect(blockedView.status).toBe(403);

    // 4. HR approves it.
    const approve = await request(app)
      .post(`/api/hrms/job-requests/${requestId}/review`)
      .set(authHeader(hr))
      .send({ action: "approve" });
    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe("approved");
    expect(approve.body.reviewedBy).toBeTruthy();

    // 5. HR publishes it into a live job post.
    const publish = await request(app)
      .post(`/api/hrms/job-requests/${requestId}/publish`)
      .set(authHeader(hr))
      .send({ applicationDeadline: "2026-12-31" });
    expect(publish.status).toBe(201);
    expect(publish.body.jobPost.status).toBe("published");
    expect(publish.body.jobRequest.status).toBe("published");
    const jobId = publish.body.jobPost._id;

    // Publishing an already-published request is rejected.
    const republish = await request(app).post(`/api/hrms/job-requests/${requestId}/publish`).set(authHeader(hr));
    expect(republish.status).toBe(409);

    // 6. An employee refers a candidate for the new opening.
    const referral = await request(app)
      .post("/api/hrms/referrals")
      .set(authHeader(employee))
      .send({ jobId, candidate: validCandidate(), notes: "Worked with them at my last company." });
    expect(referral.status).toBe(201);
    expect(referral.body.status).toBe("submitted");
    const referralId = referral.body._id;

    // Referring the same candidate for the same job twice is rejected.
    const duplicate = await request(app)
      .post("/api/hrms/referrals")
      .set(authHeader(employee))
      .send({ jobId, candidate: validCandidate() });
    expect(duplicate.status).toBe(409);

    // Invalid candidate data is rejected server-side too.
    const badEmail = await request(app)
      .post("/api/hrms/referrals")
      .set(authHeader(employee))
      .send({ jobId, candidate: validCandidate({ email: "not-an-email" }) });
    expect(badEmail.status).toBe(400);

    // The referring employee can't move the referral's status themselves.
    const blockedStatus = await request(app)
      .patch(`/api/hrms/referrals/${referralId}/status`)
      .set(authHeader(employee))
      .send({ status: "shortlisted" });
    expect(blockedStatus.status).toBe(403);

    // 7. HR moves the referral continuously through the hiring pipeline.
    const pipeline = ["under_review", "shortlisted", "interview_scheduled", "selected"];
    let lastStatus;
    for (const status of pipeline) {
      const step = await request(app)
        .patch(`/api/hrms/referrals/${referralId}/status`)
        .set(authHeader(hr))
        .send({ status, note: `Moved to ${status}` });
      expect(step.status).toBe(200);
      expect(step.body.status).toBe(status);
      lastStatus = step.body;
    }
    expect(lastStatus.statusHistory.length).toBe(1 + pipeline.length); // "submitted" + each transition
    expect(lastStatus.statusHistory.at(-1).status).toBe("selected");

    // The employee sees it in their own list...
    const mine = await request(app).get("/api/hrms/referrals/mine").set(authHeader(employee));
    expect(mine.status).toBe(200);
    expect(mine.body.find((r) => r._id === referralId)?.status).toBe("selected");

    // ...and HR sees it in the full list, filterable by status.
    const allSelected = await request(app).get("/api/hrms/referrals?status=selected").set(authHeader(hr));
    expect(allSelected.status).toBe(200);
    expect(allSelected.body.map((r) => r._id)).toContain(referralId);

    // 8. Resume access: none was uploaded on this referral, and an unrelated
    // employee can't even ask.
    const noResume = await request(app).get(`/api/hrms/referrals/${referralId}/resume-url`).set(authHeader(employee));
    expect(noResume.status).toBe(404);

    const outsider = await makeUser({ name: "Owen Outsider" });
    const blockedResume = await request(app).get(`/api/hrms/referrals/${referralId}/resume-url`).set(authHeader(outsider));
    expect(blockedResume.status).toBe(403);
  });
});
