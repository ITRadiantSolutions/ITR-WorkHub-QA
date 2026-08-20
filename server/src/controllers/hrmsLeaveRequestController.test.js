import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/LeaveRequest.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findById: vi.fn() },
}));
vi.mock("../models/LeaveType.js", () => ({
  default: { find: vi.fn(), findById: vi.fn() },
}));
vi.mock("../models/User.js", () => ({ default: { find: vi.fn(), findById: vi.fn() } }));
vi.mock("../models/CompanyHoliday.js", () => ({
  default: { find: vi.fn(), findOne: vi.fn() },
}));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("../utils/notify.js", () => ({ notifyUsers: vi.fn() }));
vi.mock("../utils/hrmsMailer.js", () => ({ sendHrmsEmail: vi.fn() }));

import LeaveRequest from "../models/LeaveRequest.js";
import LeaveType from "../models/LeaveType.js";
import User from "../models/User.js";
import CompanyHoliday from "../models/CompanyHoliday.js";
import { notifyUsers } from "../utils/notify.js";
import { sendHrmsEmail } from "../utils/hrmsMailer.js";
import {
  createLeaveRequest,
  listMyLeaveRequests,
  listTeamLeaveRequests,
  listLeaveRequests,
  getMyLeaveBalance,
  getLeaveBalanceForEmployee,
  getLeaveCalendar,
  reviewLeaveRequest,
  cancelLeaveRequest,
} from "./hrmsLeaveRequestController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

// Mimics a mongoose Query: .populate() chains onto itself, and the chain
// resolves to `result` whether awaited directly (findById flow) or via a
// trailing .sort() (find flow).
const makeQuery = (result) => {
  const query = {};
  query.populate = vi.fn().mockReturnValue(query);
  query.select = vi.fn().mockReturnValue(query);
  query.sort = vi.fn().mockResolvedValue(result);
  query.then = (resolve) => resolve(result);
  return query;
};

const makeSelectQuery = (result) => ({ select: vi.fn().mockResolvedValue(result) });

const employeeUser = (managerId = null, joiningDate = null) => ({ _id: oid(), name: "Eve Employee", managerId, joiningDate, roles: { hrms: "employee" } });
const managerUser = () => ({ _id: oid(), name: "Mo Manager", roles: { hrms: "manager" } });
const hrUser = () => ({ _id: oid(), name: "Helen HR", roles: { hrms: "hr" } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-15T00:00:00Z")); // a Saturday
  CompanyHoliday.find.mockReturnValue(makeSelectQuery([]));
  CompanyHoliday.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
  User.find.mockReturnValue({ select: vi.fn().mockResolvedValue([]) });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createLeaveRequest — working-day counting", () => {
  it("400s when leaveType is missing", async () => {
    const req = { body: {}, user: employeeUser() };
    const res = mockRes();

    await createLeaveRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(LeaveRequest.create).not.toHaveBeenCalled();
  });

  it("400s on an inactive leave type", async () => {
    LeaveType.findById.mockResolvedValue({ _id: oid(), name: "Casual", isActive: false });
    const req = { body: { leaveType: oid().toString(), startDate: "2026-09-01", endDate: "2026-09-02" }, user: employeeUser() };
    const res = mockRes();

    await createLeaveRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("excludes weekends from a multi-day request (Mon 17 - Fri 21 Aug 2026 = 5 working days)", async () => {
    const type = { _id: oid(), name: "Casual", isActive: true, defaultDaysPerYear: 12, carryForwardCap: 0 };
    LeaveType.findById.mockResolvedValue(type);
    LeaveRequest.find.mockReturnValue(makeSelectQuery([]));
    LeaveRequest.create.mockResolvedValue({ _id: oid() });
    LeaveRequest.findById.mockReturnValue(makeQuery({}));

    const req = { body: { leaveType: type._id.toString(), startDate: "2026-08-17", endDate: "2026-08-23" }, user: employeeUser() };
    await createLeaveRequest(req, mockRes());

    // 17-23 Aug 2026 spans Mon-Sun; the weekend (22nd, 23rd) is excluded -> 5 working days.
    expect(LeaveRequest.create).toHaveBeenCalledWith(expect.objectContaining({ totalDays: 5 }));
  });

  it("excludes a company holiday that falls inside the range", async () => {
    const type = { _id: oid(), name: "Casual", isActive: true, defaultDaysPerYear: 12, carryForwardCap: 0 };
    LeaveType.findById.mockResolvedValue(type);
    CompanyHoliday.find.mockReturnValue(makeSelectQuery([{ date: "2026-08-19" }]));
    LeaveRequest.find.mockReturnValue(makeSelectQuery([]));
    LeaveRequest.create.mockResolvedValue({ _id: oid() });
    LeaveRequest.findById.mockReturnValue(makeQuery({}));

    // Mon 17 - Wed 19 Aug: 3 weekdays, minus the holiday on the 19th -> 2.
    const req = { body: { leaveType: type._id.toString(), startDate: "2026-08-17", endDate: "2026-08-19" }, user: employeeUser() };
    await createLeaveRequest(req, mockRes());

    expect(LeaveRequest.create).toHaveBeenCalledWith(expect.objectContaining({ totalDays: 2 }));
  });

  it("400s a range with no working days at all", async () => {
    LeaveType.findById.mockResolvedValue({ _id: oid(), name: "Casual", isActive: true, defaultDaysPerYear: 12, carryForwardCap: 0 });
    // 22-23 Aug 2026 is a Sat-Sun.
    const req = { body: { leaveType: oid().toString(), startDate: "2026-08-22", endDate: "2026-08-23" }, user: employeeUser() };
    const res = mockRes();

    await createLeaveRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(LeaveRequest.create).not.toHaveBeenCalled();
  });

  it("400s a half-day request on a weekend", async () => {
    LeaveType.findById.mockResolvedValue({ _id: oid(), name: "Casual", isActive: true, defaultDaysPerYear: 12, carryForwardCap: 0 });
    const req = {
      body: { leaveType: oid().toString(), startDate: "2026-08-22", endDate: "2026-08-22", isHalfDay: true, halfDaySession: "first_half" },
      user: employeeUser(),
    };
    const res = mockRes();

    await createLeaveRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("createLeaveRequest — loss of pay instead of blocking", () => {
  it("allows a request beyond the balance, splitting it into paid + LOP days", async () => {
    // As of 2026-08-15 with no joining date, 8 months have accrued: 12/year -> 8 days.
    const type = { _id: oid(), name: "Casual", isActive: true, defaultDaysPerYear: 12, carryForwardCap: 0 };
    LeaveType.findById.mockResolvedValue(type);
    LeaveRequest.find.mockReturnValue(makeSelectQuery([])); // no prior usage
    LeaveRequest.create.mockResolvedValue({ _id: oid() });
    LeaveRequest.findById.mockReturnValue(makeQuery({}));

    // Mon 17 - Fri 28 Aug 2026 = 10 working days, but only 8 are in balance.
    const req = { body: { leaveType: type._id.toString(), startDate: "2026-08-17", endDate: "2026-08-28" }, user: employeeUser() };
    const res = mockRes();

    await createLeaveRequest(req, res);

    expect(LeaveRequest.create).toHaveBeenCalledWith(expect.objectContaining({ totalDays: 10, paidDays: 8, lopDays: 2 }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("fully paid when within balance — lopDays is 0", async () => {
    const type = { _id: oid(), name: "Casual", isActive: true, defaultDaysPerYear: 12, carryForwardCap: 0 };
    LeaveType.findById.mockResolvedValue(type);
    LeaveRequest.find.mockReturnValue(makeSelectQuery([]));
    LeaveRequest.create.mockResolvedValue({ _id: oid() });
    LeaveRequest.findById.mockReturnValue(makeQuery({}));

    const req = { body: { leaveType: type._id.toString(), startDate: "2026-08-17", endDate: "2026-08-17" }, user: employeeUser() };
    await createLeaveRequest(req, mockRes());

    expect(LeaveRequest.create).toHaveBeenCalledWith(expect.objectContaining({ totalDays: 1, paidDays: 1, lopDays: 0 }));
  });

  it("notifies the manager by email and in-app, flagging the LOP portion", async () => {
    const type = { _id: oid(), name: "Casual", isActive: true, defaultDaysPerYear: 12, carryForwardCap: 0 };
    LeaveType.findById.mockResolvedValue(type);
    LeaveRequest.find.mockReturnValue(makeSelectQuery([]));
    LeaveRequest.create.mockResolvedValue({ _id: oid() });
    LeaveRequest.findById.mockReturnValue(makeQuery({}));

    const manager = managerUser();
    User.find.mockReturnValue({ select: vi.fn().mockResolvedValue([{ _id: manager._id, email: "mo@example.com" }]) });
    const employee = employeeUser(manager._id);
    const req = { body: { leaveType: type._id.toString(), startDate: "2026-08-17", endDate: "2026-08-28" }, user: employee };
    await createLeaveRequest(req, mockRes());

    expect(notifyUsers).toHaveBeenCalledWith([manager._id], expect.objectContaining({ type: "leaveRequestSubmitted" }));
    expect(sendHrmsEmail).toHaveBeenCalledWith(
      "mo@example.com", expect.any(String), expect.any(String), expect.stringContaining("unpaid"),
    );
  });
});

describe("listMyLeaveRequests", () => {
  it("scopes to the calling employee", async () => {
    const employee = employeeUser();
    LeaveRequest.find.mockReturnValue(makeQuery([]));

    await listMyLeaveRequests({ query: {}, user: employee }, mockRes());

    expect(LeaveRequest.find).toHaveBeenCalledWith({ employee: employee._id });
  });
});

describe("listTeamLeaveRequests", () => {
  it("includes both direct reports and skip-level reports", async () => {
    const manager = managerUser();
    const directReportId = oid();
    const skipLevelReportId = oid();
    User.find
      .mockReturnValueOnce({ select: vi.fn().mockResolvedValue([{ _id: directReportId }]) })
      .mockReturnValueOnce({ select: vi.fn().mockResolvedValue([{ _id: skipLevelReportId }]) });
    LeaveRequest.find.mockReturnValue(makeQuery([]));

    await listTeamLeaveRequests({ query: {}, user: manager }, mockRes());

    expect(LeaveRequest.find).toHaveBeenCalledWith({ employee: { $in: [directReportId, skipLevelReportId] } });
  });
});

describe("listLeaveRequests", () => {
  it("403s a non-HR caller", async () => {
    const req = { query: {}, user: managerUser() };
    const res = mockRes();

    await listLeaveRequests(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(LeaveRequest.find).not.toHaveBeenCalled();
  });
});

describe("getMyLeaveBalance", () => {
  it("computes monthly-accrued balance minus paid usage, with no carry-forward when the cap is 0", async () => {
    const employee = employeeUser();
    const typeId = oid();
    LeaveType.find.mockResolvedValue([{ _id: typeId, name: "Casual", defaultDaysPerYear: 12, carryForwardCap: 0 }]);
    LeaveRequest.find.mockReturnValue(makeSelectQuery([{ paidDays: 2.5 }]));

    const res = mockRes();
    await getMyLeaveBalance({ user: employee }, res);

    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ accrued: 8, carriedForward: 0, allocated: 8, used: 2.5, remaining: 5.5 }),
    ]);
  });
});

describe("getLeaveBalanceForEmployee", () => {
  it("404s when the employee doesn't exist", async () => {
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
    const req = { params: { employeeId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await getLeaveBalanceForEmployee(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("computes balance using the target employee's own joining date", async () => {
    const employeeId = oid();
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: employeeId, joiningDate: null }) });
    LeaveType.find.mockResolvedValue([{ _id: oid(), name: "Casual", defaultDaysPerYear: 12, carryForwardCap: 0 }]);
    LeaveRequest.find.mockReturnValue(makeSelectQuery([]));

    const res = mockRes();
    await getLeaveBalanceForEmployee({ params: { employeeId: employeeId.toString() }, user: hrUser() }, res);

    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ accrued: 8, allocated: 8, remaining: 8 })]);
  });
});

describe("getLeaveCalendar", () => {
  it("400s without month/year", async () => {
    const req = { query: {}, user: employeeUser() };
    const res = mockRes();

    await getLeaveCalendar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns approved leave overlapping the requested month, company-wide", async () => {
    LeaveRequest.find.mockReturnValue(makeQuery([]));
    const req = { query: { month: "8", year: "2026" }, user: employeeUser() };

    await getLeaveCalendar(req, mockRes());

    expect(LeaveRequest.find).toHaveBeenCalledWith(expect.objectContaining({ status: "approved" }));
  });
});

describe("reviewLeaveRequest", () => {
  const chainOf = (employeeId, directManagerId, skipLevelManagerId) => ({
    _id: oid(),
    employee: { _id: employeeId, name: "Eve", email: "eve@example.com", managerId: { _id: directManagerId, managerId: skipLevelManagerId } },
    leaveType: { name: "Casual" },
    startDate: new Date("2026-08-17"),
    endDate: new Date("2026-08-17"),
    save: vi.fn().mockResolvedValue(undefined),
  });

  it("400s an invalid action", async () => {
    const req = { params: { id: oid().toString() }, body: { action: "maybe" }, user: hrUser() };
    const res = mockRes();

    await reviewLeaveRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("403s a manager who isn't the employee's direct manager", async () => {
    const doc = chainOf(oid(), oid(), oid());
    doc.status = "pending_manager";
    LeaveRequest.findById.mockReturnValue(makeQuery(doc));

    const req = { params: { id: doc._id.toString() }, body: { action: "approve" }, user: managerUser() };
    const res = mockRes();

    await reviewLeaveRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("409s reviewing an already-decided request", async () => {
    const doc = chainOf(oid(), oid(), oid());
    doc.status = "approved";
    LeaveRequest.findById.mockReturnValue(makeQuery(doc));

    const req = { params: { id: doc._id.toString() }, body: { action: "approve" }, user: hrUser() };
    const res = mockRes();

    await reviewLeaveRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("the direct manager's approval routes to the skip-level manager and emails them", async () => {
    const skipLevelManager = managerUser();
    const directManager = managerUser();
    const doc = chainOf(oid(), directManager._id, skipLevelManager._id);
    doc.status = "pending_manager";
    LeaveRequest.findById.mockReturnValue(makeQuery(doc));
    User.find.mockReturnValue({ select: vi.fn().mockResolvedValue([{ _id: skipLevelManager._id, email: "skip@example.com" }]) });

    const req = { params: { id: doc._id.toString() }, body: { action: "approve" }, user: directManager };
    await reviewLeaveRequest(req, mockRes());

    expect(doc.status).toBe("pending_skip_level");
    expect(doc.managerDecision.by).toBe(directManager._id);
    expect(notifyUsers).toHaveBeenCalledWith([skipLevelManager._id], expect.objectContaining({ title: "Leave request needs your approval" }));
    expect(sendHrmsEmail).toHaveBeenCalledWith("skip@example.com", expect.any(String), expect.any(String), expect.any(String));
  });

  it("the skip-level manager's approval finalizes the request and emails the employee", async () => {
    const employeeId = oid();
    const skipLevelManager = managerUser();
    const doc = chainOf(employeeId, oid(), skipLevelManager._id);
    doc.status = "pending_skip_level";
    LeaveRequest.findById.mockReturnValue(makeQuery(doc));

    const req = { params: { id: doc._id.toString() }, body: { action: "approve" }, user: skipLevelManager };
    await reviewLeaveRequest(req, mockRes());

    expect(doc.status).toBe("approved");
    expect(doc.decidedBy).toBe(skipLevelManager._id);
    expect(notifyUsers).toHaveBeenCalledWith([employeeId], expect.objectContaining({ type: "leaveRequestApproved" }));
    expect(sendHrmsEmail).toHaveBeenCalledWith("eve@example.com", expect.any(String), expect.any(String), expect.any(String));
  });

  it("an HR override at the manager stage finalizes immediately, skipping the skip-level step", async () => {
    const employeeId = oid();
    const doc = chainOf(employeeId, oid(), oid());
    doc.status = "pending_manager";
    LeaveRequest.findById.mockReturnValue(makeQuery(doc));

    const hr = hrUser();
    const req = { params: { id: doc._id.toString() }, body: { action: "approve" }, user: hr };
    await reviewLeaveRequest(req, mockRes());

    expect(doc.status).toBe("approved");
    expect(doc.decidedBy).toBe(hr._id);
  });

  it("rejects at the manager stage, ending the chain", async () => {
    const employeeId = oid();
    const directManager = managerUser();
    const doc = chainOf(employeeId, directManager._id, oid());
    doc.status = "pending_manager";
    LeaveRequest.findById.mockReturnValue(makeQuery(doc));

    const req = { params: { id: doc._id.toString() }, body: { action: "reject", comment: "Team is short-staffed" }, user: directManager };
    await reviewLeaveRequest(req, mockRes());

    expect(doc.status).toBe("rejected");
    expect(doc.decidedBy).toBe(directManager._id);
    expect(notifyUsers).toHaveBeenCalledWith([employeeId], expect.objectContaining({ type: "leaveRequestRejected" }));
  });
});

describe("cancelLeaveRequest", () => {
  it("403s cancelling someone else's request", async () => {
    LeaveRequest.findById.mockResolvedValue({ _id: oid(), employee: oid(), status: "pending_manager" });
    const req = { params: { id: oid().toString() }, user: employeeUser() };
    const res = mockRes();

    await cancelLeaveRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("409s cancelling an already-rejected request", async () => {
    const employee = employeeUser();
    LeaveRequest.findById.mockResolvedValue({ _id: oid(), employee: employee._id, status: "rejected" });
    const req = { params: { id: oid().toString() }, user: employee };
    const res = mockRes();

    await cancelLeaveRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("cancels a request pending at either stage", async () => {
    const employee = employeeUser();
    const leaveDoc = { _id: oid(), employee: employee._id, status: "pending_skip_level", save: vi.fn().mockResolvedValue(undefined) };
    LeaveRequest.findById.mockResolvedValue(leaveDoc);

    const req = { params: { id: leaveDoc._id.toString() }, user: employee };
    await cancelLeaveRequest(req, mockRes());

    expect(leaveDoc.status).toBe("cancelled");
  });
});
