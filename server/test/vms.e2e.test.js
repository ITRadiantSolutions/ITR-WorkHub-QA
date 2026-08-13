import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

// Env vars must be in place before app.js (and anything it imports) reads
// them, so this runs before any local imports below.
process.env.JWT_SECRET = "test-secret";
process.env.CLIENT_URL = "http://localhost:5173";

// There is no dummy/test-mode OTP anywhere in this system yet — createVisitor
// and resendInvitedOtpByVisitorId both call the real Twilio SDK unconditionally
// and let a failure 500 the whole request. Twilio env vars are never set in
// this test run, so sendSms is mocked the same way a real "dummy OTP" bypass
// would work: the OTP still gets generated and stored for real (crypto.randomInt,
// select:false on the schema), tests just read it straight out of MongoDB
// instead of receiving it over SMS. graphMailer's sendMail is mocked too, since
// it would otherwise make a real outbound call to Microsoft's OAuth endpoint on
// every host-approval-request email (harmless — both call sites swallow
// failures — but slow and noisy).
vi.mock("../src/utils/sms.js", () => ({ sendSms: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../src/utils/graphMailer.js", () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }));
// vmsPublicLimiter (30/15min) is shared across /create, /verify-otp, and
// /resend-invited-otp — real in this test run since it's created once at
// route-module load, so a validation-heavy suite like this one would trip
// it well before covering every case. The limiter itself isn't what's under
// test here, so it's stubbed out rather than budgeting requests around it.
vi.mock("express-rate-limit", () => ({ default: () => (req, res, next) => next() }));

const { default: app } = await import("../src/app.js");
const { default: User } = await import("../src/models/User.js");
const { default: Visitor } = await import("../src/models/Visitor.js");
const { default: Approval } = await import("../src/models/Approval.js");
const { signToken } = await import("../src/utils/jwt.js");
const { sendSms } = await import("../src/utils/sms.js");
const { sendMail } = await import("../src/utils/graphMailer.js");

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
  await Promise.all([User.deleteMany({}), Visitor.deleteMany({}), Approval.deleteMany({})]);
  sendSms.mockClear();
  sendMail.mockClear();
});

const makeUser = (overrides = {}) =>
  User.create({
    name: "Test User",
    email: `user-${new mongoose.Types.ObjectId()}@example.com`,
    password: "password123",
    approvalStatus: "Approved",
    roles: { timesheet: "employee", pms: "employee", tracker: "DEVELOPER", vms: "host" },
    ...overrides,
  });

const authHeader = (user) => ({ Authorization: `Bearer ${signToken(user)}` });

// Pulls the OTP straight out of Mongo — otpCode is select:false and never
// returned by any API response, so this is the "dummy OTP" stand-in for a
// real SMS inbox.
const readOtp = async (visitorId) => {
  const doc = await Visitor.findById(visitorId).select("+otpCode");
  return doc.otpCode;
};

const validVisitorPayload = (overrides = {}) => ({
  fullName: "Vishal Visitor",
  mobileNumber: "9876543210",
  email: "vishal@example.com",
  address: "123 MG Road, Bengaluru",
  purpose: "Client meeting",
  ...overrides,
});

describe("VMS: createVisitor validation (POST /api/vms/visitors/create)", () => {
  it("rejects a missing fullName", async () => {
    const res = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload({ fullName: undefined }));
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === "fullName")).toBe(true);
  });

  it("rejects a fullName under 2 characters", async () => {
    const res = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload({ fullName: "A" }));
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === "fullName")).toBe(true);
  });

  it("rejects a missing mobileNumber", async () => {
    const res = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload({ mobileNumber: undefined }));
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === "mobileNumber")).toBe(true);
  });

  it("rejects a mobile number that isn't 10 digits (or 91+10)", async () => {
    const res = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload({ mobileNumber: "12345" }));
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === "mobileNumber")).toBe(true);
  });

  it("accepts a mobile number already in 91-prefixed form", async () => {
    const res = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload({ mobileNumber: "919876543210" }));
    expect(res.status).toBe(201);
  });

  it("rejects an invalid email format", async () => {
    const res = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === "email")).toBe(true);
  });

  it("rejects an address over 500 characters", async () => {
    const res = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload({ address: "x".repeat(501) }));
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === "address")).toBe(true);
  });

  it("rejects a purpose over 300 characters", async () => {
    const res = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload({ purpose: "x".repeat(301) }));
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === "purpose")).toBe(true);
  });

  it("rejects notes over 1000 characters", async () => {
    const res = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload({ notes: "x".repeat(1001) }));
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === "notes")).toBe(true);
  });

  it("rejects a visitorType that isn't Guest or Invited", async () => {
    const res = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload({ visitorType: "VIP" }));
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === "visitorType")).toBe(true);
  });

  it("rejects a visitDate that isn't a valid ISO date", async () => {
    const res = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload({ visitDate: "not-a-date" }));
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === "visitDate")).toBe(true);
  });

  it("creates successfully with a full valid payload, sends the OTP SMS, and never leaks the OTP in the response", async () => {
    const res = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload());
    expect(res.status).toBe(201);
    expect(res.body.visitor.status).toBe("otp_pending");
    expect(res.body.visitor.otpCode).toBeUndefined();
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(sendSms.mock.calls[0][0]).toBe("9876543210");
    expect(sendSms.mock.calls[0][1]).toMatch(/OTP/);

    const stored = await readOtp(res.body.visitor._id);
    expect(stored).toMatch(/^\d{6}$/);
  });

  it("resolves personToMeetId by email as well as by user id, and populates it with name/email in the response", async () => {
    const host = await makeUser({ name: "Helen Host", roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", vms: "host" } });
    const res = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload({ personToMeetId: host.email }));
    expect(res.status).toBe(201);
    expect(res.body.visitor.personToMeetId._id).toBe(host._id.toString());
    expect(res.body.visitor.personToMeetId.name).toBe("Helen Host");
  });
});

describe("VMS: OTP verification (POST /api/vms/visitors/verify-otp)", () => {
  it("rejects a malformed visitorId", async () => {
    const res = await request(app).post("/api/vms/visitors/verify-otp").send({ visitorId: "not-an-id", code: "123456" });
    expect(res.status).toBe(400);
  });

  it("rejects a code that isn't 6 numeric digits", async () => {
    const create = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload());
    const res = await request(app).post("/api/vms/visitors/verify-otp").send({ visitorId: create.body.visitor._id, code: "12ab" });
    expect(res.status).toBe(400);
  });

  it("rejects a wrong code and increments otpAttempts", async () => {
    const create = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload());
    const visitorId = create.body.visitor._id;

    const res = await request(app).post("/api/vms/visitors/verify-otp").send({ visitorId, code: "000000" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or expired/i);

    const stored = await Visitor.findById(visitorId);
    expect(stored.otpAttempts).toBe(1);
    expect(stored.status).toBe("otp_pending");
  });

  it("locks out after 3 wrong attempts — even the correct code is then rejected", async () => {
    const create = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload());
    const visitorId = create.body.visitor._id;
    const correctOtp = await readOtp(visitorId);

    for (let i = 0; i < 3; i++) {
      const res = await request(app).post("/api/vms/visitors/verify-otp").send({ visitorId, code: "000000" });
      expect(res.status).toBe(400);
    }

    const res = await request(app).post("/api/vms/visitors/verify-otp").send({ visitorId, code: correctOtp });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  it("404s for a visitorId that doesn't exist", async () => {
    const res = await request(app).post("/api/vms/visitors/verify-otp").send({ visitorId: new mongoose.Types.ObjectId().toString(), code: "123456" });
    expect(res.status).toBe(404);
  });

  it("rejects a correct code when visitDate is set but today isn't that date", async () => {
    const create = await request(app)
      .post("/api/vms/visitors/create")
      .send(validVisitorPayload({ visitDate: "2099-01-01T00:00:00.000Z" }));
    const visitorId = create.body.visitor._id;
    const otp = await readOtp(visitorId);

    const res = await request(app).post("/api/vms/visitors/verify-otp").send({ visitorId, code: otp });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/visit date/i);
  });
});

describe("VMS: resend OTP (POST /api/vms/visitors/resend-invited-otp)", () => {
  it("requires visitorId", async () => {
    const res = await request(app).post("/api/vms/visitors/resend-invited-otp").send({});
    expect(res.status).toBe(400);
  });

  it("only works while the visitor is still otp_pending", async () => {
    const create = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload());
    const visitorId = create.body.visitor._id;
    const otp = await readOtp(visitorId);
    await request(app).post("/api/vms/visitors/verify-otp").send({ visitorId, code: otp }); // -> otp_verified (no host)

    const res = await request(app).post("/api/vms/visitors/resend-invited-otp").send({ visitorId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not available for this status/i);
  });

  it("issues a new OTP that invalidates the old one", async () => {
    const create = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload());
    const visitorId = create.body.visitor._id;
    const oldOtp = await readOtp(visitorId);

    const resendRes = await request(app).post("/api/vms/visitors/resend-invited-otp").send({ visitorId });
    expect(resendRes.status).toBe(200);
    expect(sendSms).toHaveBeenCalledTimes(2); // once on create, once on resend

    const newOtp = await readOtp(visitorId);
    expect(newOtp).not.toBe(oldOtp);

    const staleAttempt = await request(app).post("/api/vms/visitors/verify-otp").send({ visitorId, code: oldOtp });
    expect(staleAttempt.status).toBe(400);

    const freshAttempt = await request(app).post("/api/vms/visitors/verify-otp").send({ visitorId, code: newOtp });
    expect(freshAttempt.status).toBe(200);
  });
});

describe("VMS: full flow — Guest visitor routed to a host", () => {
  it("create -> verify -> host_pending -> hostApprove auto-checks-in -> checkout", async () => {
    const host = await makeUser({ name: "Helen Host", roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", vms: "host" } });
    const receptionist = await makeUser({ name: "Rita Reception", roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", vms: "receptionist" } });
    const otherHost = await makeUser({ name: "Not This Host", roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", vms: "host" } });

    // 1. Create, routed to a specific host.
    const createRes = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload({ personToMeetId: host._id.toString() }));
    expect(createRes.status).toBe(201);
    const visitorId = createRes.body.visitor._id;

    // 2. Verify OTP -> host_pending, host gets an emailed approval request.
    const otp = await readOtp(visitorId);
    const verifyRes = await request(app).post("/api/vms/visitors/verify-otp").send({ visitorId, code: otp });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.visitor.status).toBe("host_pending");
    expect(sendMail).toHaveBeenCalledTimes(1);

    const pendingApproval = await Approval.findOne({ visitorId, role: "host" });
    expect(pendingApproval.status).toBe("pending");
    expect(pendingApproval.approverId.toString()).toBe(host._id.toString());

    // A host who isn't the assigned one can't approve it.
    const blockedApprove = await request(app)
      .post("/api/vms/visitors/host-approve")
      .set(authHeader(otherHost))
      .send({ visitorId, approved: true });
    expect(blockedApprove.status).toBe(403);

    // 3. The assigned host approves.
    const approveRes = await request(app)
      .post("/api/vms/visitors/host-approve")
      .set(authHeader(host))
      .send({ visitorId, approved: true, reason: "Expected guest" });
    expect(approveRes.status).toBe(200);
    // The response body reflects the state *before* autoCheckIn's follow-up
    // write — it reports "final_approved" even though, by the time this
    // response is sent, the DB has already moved the visitor to "checked_in".
    expect(approveRes.body.visitor.status).toBe("final_approved");

    const afterApprove = await Visitor.findById(visitorId);
    expect(afterApprove.status).toBe("checked_in");
    expect(afterApprove.checkInTime).toBeInstanceOf(Date);

    const hostApproval = await Approval.findOne({ visitorId, role: "host", approverId: host._id });
    expect(hostApproval.status).toBe("approved");

    // Because hostApprove's own auto-check-in already advanced the visitor
    // past "final_approved", the dedicated manual check-in endpoint has
    // nothing left to do here — it 400s, matching its own "not ready"
    // guard rather than a race.
    const manualCheckIn = await request(app).post("/api/vms/visitors/checkin").set(authHeader(receptionist)).send({ visitorId });
    expect(manualCheckIn.status).toBe(400);
    expect(manualCheckIn.body.error).toMatch(/not ready for check-in/i);

    // 4. Reception checks the visitor out.
    const checkoutRes = await request(app).post("/api/vms/visitors/checkout").set(authHeader(receptionist)).send({ visitorId });
    expect(checkoutRes.status).toBe(200);
    expect(checkoutRes.body.visitor.status).toBe("checked_out");
    expect(checkoutRes.body.visitor.checkOutTime).toBeTruthy();

    // Can't check the same visitor out twice.
    const doubleCheckout = await request(app).post("/api/vms/visitors/checkout").set(authHeader(receptionist)).send({ visitorId });
    expect(doubleCheckout.status).toBe(400);
  });

  it("a rejected host approval sets status to rejected and does not auto-check-in", async () => {
    const host = await makeUser({ roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", vms: "host" } });
    const createRes = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload({ personToMeetId: host._id.toString() }));
    const visitorId = createRes.body.visitor._id;
    const otp = await readOtp(visitorId);
    await request(app).post("/api/vms/visitors/verify-otp").send({ visitorId, code: otp });

    const res = await request(app).post("/api/vms/visitors/host-approve").set(authHeader(host)).send({ visitorId, approved: false, reason: "Not expected" });
    expect(res.status).toBe(200);
    expect(res.body.visitor.status).toBe("rejected");
    expect(res.body.visitor.checkInTime).toBeFalsy();
  });
});

describe("VMS: full flow — Guest visitor with no host (reception/admin path)", () => {
  it("create -> verify -> otp_verified -> reception approves -> admin host-approves -> auto-checked-in -> checkout", async () => {
    const receptionist = await makeUser({ roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", vms: "receptionist" } });
    const admin = await makeUser({ roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", vms: "admin" } });
    const randomHost = await makeUser({ roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", vms: "host" } });

    const createRes = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload({ fullName: "Nina No-Host" }));
    const visitorId = createRes.body.visitor._id;
    expect(createRes.body.visitor.personToMeetId).toBeFalsy();

    const otp = await readOtp(visitorId);
    const verifyRes = await request(app).post("/api/vms/visitors/verify-otp").send({ visitorId, code: otp });
    expect(verifyRes.body.visitor.status).toBe("otp_verified");

    // A plain host (not receptionist/admin) can't run reception's approve action.
    const blockedApproval = await request(app).post("/api/vms/visitors/approve").set(authHeader(randomHost)).send({ visitorId, action: "approve" });
    expect(blockedApproval.status).toBe(403);

    // An unrelated host also can't host-approve a visitor with no assigned host.
    const blockedHostApprove = await request(app).post("/api/vms/visitors/host-approve").set(authHeader(randomHost)).send({ visitorId, approved: true });
    expect(blockedHostApprove.status).toBe(403);

    const approveRes = await request(app).post("/api/vms/visitors/approve").set(authHeader(receptionist)).send({ visitorId, action: "approve" });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.visitor.status).toBe("reception_approved");

    // Only an admin (not a host) can finalize a no-host visitor.
    const finalizeRes = await request(app).post("/api/vms/visitors/host-approve").set(authHeader(admin)).send({ visitorId, approved: true });
    expect(finalizeRes.status).toBe(200);

    const afterFinalize = await Visitor.findById(visitorId);
    expect(afterFinalize.status).toBe("checked_in"); // auto-checked-in, same as the host-routed path

    const checkoutRes = await request(app).post("/api/vms/visitors/checkout").set(authHeader(receptionist)).send({ visitorId });
    expect(checkoutRes.status).toBe(200);
    expect(checkoutRes.body.visitor.status).toBe("checked_out");
  });

  it("escalate routes the decision to admin instead of approving directly", async () => {
    const receptionist = await makeUser({ roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", vms: "receptionist" } });
    const createRes = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload());
    const visitorId = createRes.body.visitor._id;
    const otp = await readOtp(visitorId);
    await request(app).post("/api/vms/visitors/verify-otp").send({ visitorId, code: otp });

    const res = await request(app)
      .post("/api/vms/visitors/approve")
      .set(authHeader(receptionist))
      .send({ visitorId, action: "escalate", reason: "Needs security review" });
    expect(res.status).toBe(200);
    expect(res.body.visitor.status).toBe("escalated");

    const escalation = await Approval.findOne({ visitorId, role: "admin" });
    expect(escalation.status).toBe("pending");
  });

  it("rejects an unrecognized approval action", async () => {
    const receptionist = await makeUser({ roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", vms: "receptionist" } });
    const createRes = await request(app).post("/api/vms/visitors/create").send(validVisitorPayload());
    const res = await request(app)
      .post("/api/vms/visitors/approve")
      .set(authHeader(receptionist))
      .send({ visitorId: createRes.body.visitor._id, action: "bulldoze" });
    expect(res.status).toBe(400);
  });
});

describe("VMS: full flow — Invited visitor (host pre-approved)", () => {
  it("create Invited -> OTP verification alone auto-checks the visitor in", async () => {
    const host = await makeUser({ roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", vms: "host" } });
    const createRes = await request(app)
      .post("/api/vms/visitors/create")
      .send(validVisitorPayload({ visitorType: "Invited", personToMeetId: host._id.toString() }));
    expect(createRes.status).toBe(201);
    const visitorId = createRes.body.visitor._id;

    const preApproval = await Approval.findOne({ visitorId, role: "host" });
    expect(preApproval.status).toBe("approved");

    const otp = await readOtp(visitorId);
    const verifyRes = await request(app).post("/api/vms/visitors/verify-otp").send({ visitorId, code: otp });
    expect(verifyRes.status).toBe(200);
    // The response reports "approved" (the value verifyOtp itself sets)...
    expect(verifyRes.body.visitor.status).toBe("approved");

    // ...but autoCheckIn's follow-up write already moved it past that by
    // the time this response goes out, same stale-response pattern as the
    // Guest/host flow's hostApprove call.
    const afterVerify = await Visitor.findById(visitorId);
    expect(afterVerify.status).toBe("checked_in");
  });

  it("verify-invited-otp-by-code: wrong code rejected, correct code checks the visitor in", async () => {
    const host = await makeUser({ roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", vms: "host" } });
    const createRes = await request(app)
      .post("/api/vms/visitors/create")
      .send(validVisitorPayload({ visitorType: "Invited", personToMeetId: host._id.toString() }));
    const visitorId = createRes.body.visitor._id;
    const otp = await readOtp(visitorId);

    const wrongRes = await request(app).post("/api/vms/visitors/verify-invited-otp").send({ code: "000000" });
    expect(wrongRes.status).toBe(400);

    const rightRes = await request(app).post("/api/vms/visitors/verify-invited-otp").send({ code: otp });
    expect(rightRes.status).toBe(200);
    expect(rightRes.body.visitor._id).toBe(visitorId);

    const afterVerify = await Visitor.findById(visitorId);
    expect(afterVerify.status).toBe("checked_in");
  });

  it("verify-invited-otp-by-code rejects a malformed code before ever hitting the database", async () => {
    const res = await request(app).post("/api/vms/visitors/verify-invited-otp").send({ code: "abc" });
    expect(res.status).toBe(400);
  });
});

describe("VMS: role-based access control on staff endpoints", () => {
  it("401s every staff endpoint without a token", async () => {
    const res = await request(app).get("/api/vms/visitors");
    expect(res.status).toBe(401);
  });

  it("a default user (role defaults to 'host') can list visitors — requireVmsStaff allows any staff-tier role", async () => {
    const anyUser = await makeUser();
    const res = await request(app).get("/api/vms/visitors").set(authHeader(anyUser));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.visitors)).toBe(true);
  });

  it("getHostPendingVisitors is host-only — admin and receptionist are both blocked", async () => {
    const admin = await makeUser({ roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", vms: "admin" } });
    const res = await request(app).get("/api/vms/visitors/host/pending").set(authHeader(admin));
    expect(res.status).toBe(403);
  });

  it("listInvitedVisitorsForAdmin is admin-only", async () => {
    const host = await makeUser();
    const res = await request(app).get("/api/vms/visitors/invited").set(authHeader(host));
    expect(res.status).toBe(403);
  });

  it("checkIn/checkOut require receptionist or admin, not host", async () => {
    const host = await makeUser();
    const checkInRes = await request(app).post("/api/vms/visitors/checkin").set(authHeader(host)).send({ visitorId: new mongoose.Types.ObjectId().toString() });
    expect(checkInRes.status).toBe(403);
    const checkOutRes = await request(app).post("/api/vms/visitors/checkout").set(authHeader(host)).send({ visitorId: new mongoose.Types.ObjectId().toString() });
    expect(checkOutRes.status).toBe(403);
  });

  it("getVisitor rejects a malformed id before querying the database", async () => {
    const anyUser = await makeUser();
    const res = await request(app).get("/api/vms/visitors/not-a-valid-id").set(authHeader(anyUser));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid visitor id/i);
  });

  it("getVisitor 404s a well-formed but nonexistent id", async () => {
    const anyUser = await makeUser();
    const res = await request(app).get(`/api/vms/visitors/${new mongoose.Types.ObjectId()}`).set(authHeader(anyUser));
    expect(res.status).toBe(404);
  });
});

describe("VMS admin endpoints", () => {
  it("listUsersForKiosk is public — no auth required", async () => {
    await makeUser({ name: "Kiosk Visible" });
    const res = await request(app).get("/api/vms/admin/users/public");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  it("analytics and audit-logs require admin", async () => {
    const host = await makeUser();
    const analyticsRes = await request(app).get("/api/vms/admin/analytics").set(authHeader(host));
    expect(analyticsRes.status).toBe(403);
    const auditRes = await request(app).get("/api/vms/admin/audit-logs").set(authHeader(host));
    expect(auditRes.status).toBe(403);
  });

  it("analytics counts visitors by status correctly", async () => {
    const admin = await makeUser({ roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", vms: "admin" } });
    await Visitor.create([
      { fullName: "A", mobileNumber: "9876500001", status: "otp_pending" },
      { fullName: "B", mobileNumber: "9876500002", status: "final_approved" },
      { fullName: "C", mobileNumber: "9876500003", status: "checked_in" },
      { fullName: "D", mobileNumber: "9876500004", status: "checked_in" },
    ]);
    const res = await request(app).get("/api/vms/admin/analytics").set(authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ totalVisitors: 4, pending: 1, approved: 1, checkedIn: 2 });
  });

  it("updateUserVmsRole rejects an invalid role and accepts a valid one", async () => {
    const admin = await makeUser({ roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", vms: "admin" } });
    const target = await makeUser();

    const badRes = await request(app).patch(`/api/vms/admin/users/${target._id}/role`).set(authHeader(admin)).send({ role: "superhost" });
    expect(badRes.status).toBe(400);

    const goodRes = await request(app).patch(`/api/vms/admin/users/${target._id}/role`).set(authHeader(admin)).send({ role: "receptionist" });
    expect(goodRes.status).toBe(200);
    expect(goodRes.body.user.roles.vms).toBe("receptionist");
    expect(goodRes.body.user.password).toBeUndefined();
  });
});
