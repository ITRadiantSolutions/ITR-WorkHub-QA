import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/LeaveRequest.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findOne: vi.fn(), findById: vi.fn() },
}));
vi.mock("../models/LeaveType.js", () => ({
  default: { find: vi.fn(), findById: vi.fn() },
}));
vi.mock("../models/LeaveGrant.js", () => ({
  default: { create: vi.fn(), find: vi.fn() },
}));
vi.mock("../models/User.js", () => ({ default: { find: vi.fn(), findById: vi.fn() } }));
vi.mock("../models/CompanyHoliday.js", () => ({
  default: { find: vi.fn(), findOne: vi.fn() },
}));
vi.mock("../config/blobStorage.js", () => ({ uploadAttachment: vi.fn(), createReadUrl: vi.fn(() => "https://signed.example/document") }));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("../utils/notify.js", () => ({ notifyUsers: vi.fn() }));
vi.mock("../utils/hrmsMailer.js", () => ({ sendHrmsEmail: vi.fn() }));

import LeaveRequest from "../models/LeaveRequest.js";
import LeaveType from "../models/LeaveType.js";
import LeaveGrant from "../models/LeaveGrant.js";
import User from "../models/User.js";
import CompanyHoliday from "../models/CompanyHoliday.js";
import { uploadAttachment } from "../config/blobStorage.js";
import { notifyUsers } from "../utils/notify.js";
import { sendHrmsEmail } from "../utils/hrmsMailer.js";
import {
  createLeaveRequest,
  createLeaveRequestForEmployee,
  listMyLeaveRequests,
  listTeamLeaveRequests,
  listLeaveRequests,
  getMyLeaveBalance,
  getLeaveBalanceForEmployee,
  getLeaveCalendar,
  getLeaveLedger,
  getLeaveDocumentUrl,
  grantLeave,
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
  LeaveRequest.findOne.mockReturnValue(makeSelectQuery(null)); // no overlapping request by default
  LeaveGrant.find.mockReturnValue(makeQuery([])); // no manual grants by default — supports both .select() and .sort()
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

  it("treats a multi-day request as full days, not half, when isHalfDay arrives as the string \"false\" (multipart/form-data)", async () => {
    // Regression: the request goes through multer as multipart/form-data (to
    // allow an optional document upload), so every field — including this
    // checkbox — arrives as a string. The string "false" is truthy in plain
    // JS, so a naive `if (isHalfDay)` treated every request as a half-day
    // regardless of the selected date range.
    const type = { _id: oid(), name: "Bereavement", isActive: true, defaultDaysPerYear: 3, carryForwardCap: 0 };
    LeaveType.findById.mockResolvedValue(type);
    LeaveRequest.find.mockReturnValue(makeSelectQuery([]));
    LeaveRequest.create.mockResolvedValue({ _id: oid() });
    LeaveRequest.findById.mockReturnValue(makeQuery({}));

    const req = {
      body: {
        leaveType: type._id.toString(), startDate: "2026-08-17", endDate: "2026-08-19",
        isHalfDay: "false", halfDaySession: "first_half",
      },
      user: employeeUser(),
    };
    await createLeaveRequest(req, mockRes());

    // Mon 17 - Wed 19 Aug 2026 = 3 working days.
    expect(LeaveRequest.create).toHaveBeenCalledWith(expect.objectContaining({ totalDays: 3, isHalfDay: false, halfDaySession: null }));
  });

  it("still recognizes a real half-day request when isHalfDay arrives as the string \"true\"", async () => {
    const type = { _id: oid(), name: "Paternity", isActive: true, defaultDaysPerYear: 5, carryForwardCap: 0 };
    LeaveType.findById.mockResolvedValue(type);
    LeaveRequest.find.mockReturnValue(makeSelectQuery([]));
    LeaveRequest.create.mockResolvedValue({ _id: oid() });
    LeaveRequest.findById.mockReturnValue(makeQuery({}));

    const req = {
      body: {
        leaveType: type._id.toString(), startDate: "2026-08-17", endDate: "2026-08-17",
        isHalfDay: "true", halfDaySession: "second_half",
      },
      user: employeeUser(),
    };
    await createLeaveRequest(req, mockRes());

    expect(LeaveRequest.create).toHaveBeenCalledWith(expect.objectContaining({ totalDays: 0.5, isHalfDay: true, halfDaySession: "second_half" }));
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

  it("blocks a request beyond the balance for a leave type with allowExcessAsLop: false", async () => {
    // Fixed-quota event leave (Bereavement, Election Day, Paternity) — the
    // excess should be rejected outright, not silently split into LOP.
    const type = { _id: oid(), name: "Bereavement", isActive: true, defaultDaysPerYear: 3, accrualType: "yearly", carryForwardCap: 0, allowExcessAsLop: false };
    LeaveType.findById.mockResolvedValue(type);
    LeaveRequest.find.mockReturnValue(makeSelectQuery([])); // no prior usage
    LeaveRequest.create.mockResolvedValue({ _id: oid() });

    // Mon 17 - Fri 21 Aug 2026 = 5 working days, only 3 in the (yearly) balance.
    const req = { body: { leaveType: type._id.toString(), startDate: "2026-08-17", endDate: "2026-08-21" }, user: employeeUser() };
    const res = mockRes();

    await createLeaveRequest(req, res);

    expect(LeaveRequest.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("3 day(s)") }));
  });

  it("allows a request within the balance for a leave type with allowExcessAsLop: false", async () => {
    const type = { _id: oid(), name: "Bereavement", isActive: true, defaultDaysPerYear: 3, accrualType: "yearly", carryForwardCap: 0, allowExcessAsLop: false };
    LeaveType.findById.mockResolvedValue(type);
    LeaveRequest.find.mockReturnValue(makeSelectQuery([]));
    LeaveRequest.create.mockResolvedValue({ _id: oid() });
    LeaveRequest.findById.mockReturnValue(makeQuery({}));

    // Mon 17 - Tue 18 Aug 2026 = 2 working days, within the 3-day balance.
    const req = { body: { leaveType: type._id.toString(), startDate: "2026-08-17", endDate: "2026-08-18" }, user: employeeUser() };
    const res = mockRes();

    await createLeaveRequest(req, res);

    expect(LeaveRequest.create).toHaveBeenCalledWith(expect.objectContaining({ totalDays: 2, paidDays: 2, lopDays: 0 }));
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

describe("createLeaveRequest — overlap and document requirements", () => {
  it("409s a self-service request overlapping an existing active request", async () => {
    LeaveType.findById.mockResolvedValue({ _id: oid(), name: "Casual", isActive: true, defaultDaysPerYear: 12, carryForwardCap: 0 });
    LeaveRequest.findOne.mockReturnValue(makeSelectQuery({ _id: oid() }));

    const req = { body: { leaveType: oid().toString(), startDate: "2026-08-17", endDate: "2026-08-17" }, user: employeeUser() };
    const res = mockRes();

    await createLeaveRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(LeaveRequest.create).not.toHaveBeenCalled();
  });

  it("400s when the leave type requires a document and none is attached", async () => {
    LeaveType.findById.mockResolvedValue({ _id: oid(), name: "Sick", isActive: true, defaultDaysPerYear: 6, requiresDocument: true });

    const req = { body: { leaveType: oid().toString(), startDate: "2026-08-17", endDate: "2026-08-17" }, user: employeeUser() };
    const res = mockRes();

    await createLeaveRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(LeaveRequest.create).not.toHaveBeenCalled();
  });

  it("uploads the attached document when the leave type requires one", async () => {
    const type = { _id: oid(), name: "Sick", isActive: true, defaultDaysPerYear: 6, requiresDocument: true };
    LeaveType.findById.mockResolvedValue(type);
    LeaveRequest.find.mockReturnValue(makeSelectQuery([]));
    const created = { _id: oid(), save: vi.fn() };
    LeaveRequest.create.mockResolvedValue(created);
    LeaveRequest.findById.mockReturnValue(makeQuery({}));
    uploadAttachment.mockResolvedValue({ blobName: "hrms-leave-document/abc.pdf" });

    const req = {
      body: { leaveType: type._id.toString(), startDate: "2026-08-17", endDate: "2026-08-17" },
      file: { buffer: Buffer.from("x"), originalname: "cert.pdf", mimetype: "application/pdf" },
      user: employeeUser(),
    };
    await createLeaveRequest(req, mockRes());

    expect(uploadAttachment).toHaveBeenCalledWith(expect.objectContaining({ fileName: "cert.pdf", scope: "hrms-leave-document" }));
    expect(created.documentBlobName).toBe("hrms-leave-document/abc.pdf");
    expect(created.save).toHaveBeenCalled();
  });
});

describe("createLeaveRequestForEmployee", () => {
  it("403s a non-HR caller", async () => {
    const req = { body: { employeeId: oid().toString() }, user: managerUser() };
    const res = mockRes();

    await createLeaveRequestForEmployee(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("400s when employeeId is missing", async () => {
    const req = { body: {}, user: hrUser() };
    const res = mockRes();

    await createLeaveRequestForEmployee(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("404s an unknown employee", async () => {
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
    const req = { body: { employeeId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await createLeaveRequestForEmployee(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("skips the overlap check, unlike self-service submission", async () => {
    const employee = { _id: oid(), name: "Eve", email: "eve@example.com", managerId: null, joiningDate: null };
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(employee) });
    LeaveType.findById.mockResolvedValue({ _id: oid(), name: "Casual", isActive: true, defaultDaysPerYear: 12, carryForwardCap: 0 });
    LeaveRequest.find.mockReturnValue(makeSelectQuery([]));
    LeaveRequest.create.mockResolvedValue({ _id: oid() });
    LeaveRequest.findById.mockReturnValue(makeQuery({}));

    const hr = hrUser();
    const req = {
      body: { employeeId: employee._id.toString(), leaveType: oid().toString(), startDate: "2026-08-17", endDate: "2026-08-17" },
      user: hr,
    };
    const res = mockRes();
    await createLeaveRequestForEmployee(req, res);

    expect(LeaveRequest.findOne).not.toHaveBeenCalled();
    expect(LeaveRequest.create).toHaveBeenCalledWith(expect.objectContaining({ employee: employee._id, appliedBy: hr._id }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("getLeaveDocumentUrl", () => {
  it("404s when the request doesn't exist", async () => {
    LeaveRequest.findById.mockReturnValue(makeSelectQuery(null));
    const req = { params: { id: oid().toString() }, user: employeeUser() };
    const res = mockRes();

    await getLeaveDocumentUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403s someone who isn't the owner, a manager, or HR", async () => {
    LeaveRequest.findById.mockReturnValue(makeSelectQuery({ _id: oid(), employee: oid(), documentBlobName: "x" }));
    const req = { params: { id: oid().toString() }, user: employeeUser() };
    const res = mockRes();

    await getLeaveDocumentUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns a signed URL for the owning employee", async () => {
    const employee = employeeUser();
    LeaveRequest.findById.mockReturnValue(makeSelectQuery({ _id: oid(), employee: employee._id, documentBlobName: "x", documentFileName: "cert.pdf" }));
    const req = { params: { id: oid().toString() }, user: employee };
    const res = mockRes();

    await getLeaveDocumentUrl(req, res);

    expect(res.json).toHaveBeenCalledWith({ url: "https://signed.example/document", fileName: "cert.pdf" });
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

  it("grants the full annual quota immediately for a 'yearly' accrual type", async () => {
    const employee = employeeUser();
    const typeId = oid();
    LeaveType.find.mockResolvedValue([{ _id: typeId, name: "Bereavement", accrualType: "yearly", defaultDaysPerYear: 5, carryForwardCap: 0 }]);
    LeaveRequest.find.mockReturnValue(makeSelectQuery([]));

    const res = mockRes();
    await getMyLeaveBalance({ user: employee }, res);

    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ accrued: 5, allocated: 5, remaining: 5 })]);
  });

  it("carries forward half of last year's unused balance when carryForwardMode is 'half'", async () => {
    // Joined before last year, so all 12 months of 2025 accrued 12 days; 4 used -> 8 remaining -> half = 4.
    const employee = employeeUser(null, new Date("2020-01-01"));
    const typeId = oid();
    LeaveType.find.mockResolvedValue([{ _id: typeId, name: "Paid Leave", accrualType: "yearly", defaultDaysPerYear: 12, carryForwardMode: "half" }]);
    LeaveRequest.find
      .mockReturnValueOnce(makeSelectQuery([{ paidDays: 4 }])) // prior-year usage (computeCarryForward)
      .mockReturnValueOnce(makeSelectQuery([])); // this-year usage (balanceForType)

    const res = mockRes();
    await getMyLeaveBalance({ user: employee }, res);

    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ carriedForward: 4 })]);
  });

  it("carries forward all of last year's unused balance when carryForwardMode is 'all'", async () => {
    const employee = employeeUser(null, new Date("2020-01-01"));
    const typeId = oid();
    LeaveType.find.mockResolvedValue([{ _id: typeId, name: "Paid Leave", accrualType: "yearly", defaultDaysPerYear: 12, carryForwardMode: "all" }]);
    LeaveRequest.find
      .mockReturnValueOnce(makeSelectQuery([{ paidDays: 4 }]))
      .mockReturnValueOnce(makeSelectQuery([]));

    const res = mockRes();
    await getMyLeaveBalance({ user: employee }, res);

    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ carriedForward: 8 })]);
  });

  it("caps carry-forward at carryForwardCap when carryForwardMode is 'fixed_cap'", async () => {
    const employee = employeeUser(null, new Date("2020-01-01"));
    const typeId = oid();
    LeaveType.find.mockResolvedValue([{ _id: typeId, name: "Paid Leave", accrualType: "yearly", defaultDaysPerYear: 12, carryForwardMode: "fixed_cap", carryForwardCap: 3 }]);
    LeaveRequest.find
      .mockReturnValueOnce(makeSelectQuery([{ paidDays: 4 }])) // 8 remaining, capped at 3
      .mockReturnValueOnce(makeSelectQuery([]));

    const res = mockRes();
    await getMyLeaveBalance({ user: employee }, res);

    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ carriedForward: 3 })]);
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

describe("getLeaveLedger", () => {
  it("403s a non-HR caller requesting someone else's ledger", async () => {
    const req = { params: { leaveTypeId: oid().toString() }, query: { employeeId: oid().toString() }, user: employeeUser() };
    const res = mockRes();

    await getLeaveLedger(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("404s an unknown leave type", async () => {
    LeaveType.findById.mockResolvedValue(null);
    const req = { params: { leaveTypeId: oid().toString() }, query: {}, user: employeeUser() };
    const res = mockRes();

    await getLeaveLedger(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("produces one monthly accrual entry per elapsed month, summing to the same total as the balance card", async () => {
    const typeId = oid();
    LeaveType.findById.mockResolvedValue({ _id: typeId, name: "Casual", accrualType: "monthly", defaultDaysPerYear: 12, carryForwardCap: 0 });
    LeaveRequest.find.mockReturnValue(makeQuery([]));

    const req = { params: { leaveTypeId: typeId.toString() }, query: { year: "2026" }, user: employeeUser() };
    const res = mockRes();

    await getLeaveLedger(req, res);

    const [{ entries }] = res.json.mock.calls[0];
    const accrualEntries = entries.filter((e) => e.change > 0);
    expect(accrualEntries).toHaveLength(8); // Jan through Aug
    expect(accrualEntries.every((e) => e.change === 1)).toBe(true);
    expect(entries[entries.length - 1].balance).toBe(8);
  });

  it("produces a single lump-sum entry for a 'yearly' accrual type", async () => {
    const typeId = oid();
    LeaveType.findById.mockResolvedValue({ _id: typeId, name: "Bereavement", accrualType: "yearly", defaultDaysPerYear: 5, carryForwardCap: 0 });
    LeaveRequest.find.mockReturnValue(makeQuery([]));

    const req = { params: { leaveTypeId: typeId.toString() }, query: { year: "2026" }, user: employeeUser() };
    const res = mockRes();

    await getLeaveLedger(req, res);

    const [{ entries }] = res.json.mock.calls[0];
    expect(entries).toEqual([expect.objectContaining({ change: 5, balance: 5, reason: expect.stringContaining("start of year") })]);
  });

  it("includes a debit entry per leave request, noting the unpaid portion", async () => {
    const typeId = oid();
    LeaveType.findById.mockResolvedValue({ _id: typeId, name: "Casual", accrualType: "monthly", defaultDaysPerYear: 12, carryForwardCap: 0 });
    const request = { _id: oid(), startDate: new Date("2026-03-10"), paidDays: 2, lopDays: 1, status: "approved" };
    LeaveRequest.find.mockReturnValue(makeQuery([request]));

    const req = { params: { leaveTypeId: typeId.toString() }, query: { year: "2026" }, user: employeeUser() };
    const res = mockRes();

    await getLeaveLedger(req, res);

    const [{ entries }] = res.json.mock.calls[0];
    const debit = entries.find((e) => e.change < 0);
    expect(debit).toMatchObject({ change: -2, reason: expect.stringContaining("1 day(s) unpaid") });
  });

  it("HR can view another employee's ledger using that employee's joining date", async () => {
    const employeeId = oid();
    const typeId = oid();
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: employeeId, joiningDate: null }) });
    LeaveType.findById.mockResolvedValue({ _id: typeId, name: "Casual", accrualType: "yearly", defaultDaysPerYear: 12, carryForwardCap: 0 });
    LeaveRequest.find.mockReturnValue(makeQuery([]));

    const req = { params: { leaveTypeId: typeId.toString() }, query: { employeeId: employeeId.toString() }, user: hrUser() };
    const res = mockRes();

    await getLeaveLedger(req, res);

    expect(User.findById).toHaveBeenCalledWith(employeeId.toString());
    expect(res.status).not.toHaveBeenCalledWith(403);
  });
});

describe("grantLeave", () => {
  it("400s when employeeId or leaveTypeId is missing", async () => {
    const req = { body: { days: 1 }, user: hrUser() };
    const res = mockRes();

    await grantLeave(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(LeaveGrant.create).not.toHaveBeenCalled();
  });

  it("400s a non-positive days value", async () => {
    const req = { body: { employeeId: oid().toString(), leaveTypeId: oid().toString(), days: 0 }, user: hrUser() };
    const res = mockRes();

    await grantLeave(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("404s an unknown employee", async () => {
    User.findById.mockReturnValue(makeSelectQuery(null));
    LeaveType.findById.mockResolvedValue({ _id: oid(), name: "Comp Off", isActive: true });
    const req = { body: { employeeId: oid().toString(), leaveTypeId: oid().toString(), days: 1 }, user: hrUser() };
    const res = mockRes();

    await grantLeave(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("400s an inactive leave type", async () => {
    User.findById.mockReturnValue(makeSelectQuery({ _id: oid(), name: "Eve", email: "eve@example.com" }));
    LeaveType.findById.mockResolvedValue({ _id: oid(), name: "Comp Off", isActive: false });
    const req = { body: { employeeId: oid().toString(), leaveTypeId: oid().toString(), days: 1 }, user: hrUser() };
    const res = mockRes();

    await grantLeave(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("creates a grant, notifies, and emails the employee", async () => {
    const employeeId = oid();
    const employee = { _id: employeeId, name: "Eve Employee", email: "eve@example.com" };
    const leaveType = { _id: oid(), name: "Comp Off", isActive: true };
    User.findById.mockReturnValue(makeSelectQuery(employee));
    LeaveType.findById.mockResolvedValue(leaveType);
    LeaveGrant.create.mockResolvedValue({ _id: oid(), employee: employeeId, leaveType: leaveType._id, days: 1 });

    const hr = hrUser();
    const req = {
      body: { employeeId: employeeId.toString(), leaveTypeId: leaveType._id.toString(), days: 1, reason: "Worked Saturday" },
      user: hr,
    };
    const res = mockRes();
    await grantLeave(req, res);

    expect(LeaveGrant.create).toHaveBeenCalledWith(expect.objectContaining({
      employee: employeeId.toString(), leaveType: leaveType._id.toString(), days: 1, reason: "Worked Saturday", grantedBy: hr._id,
    }));
    expect(notifyUsers).toHaveBeenCalledWith([employeeId.toString()], expect.objectContaining({ type: "leaveGranted" }));
    expect(sendHrmsEmail).toHaveBeenCalledWith("eve@example.com", expect.any(String), expect.any(String), expect.any(String));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("getMyLeaveBalance — manual grants", () => {
  it("adds granted days into the allocated/remaining balance", async () => {
    const employee = employeeUser();
    LeaveType.find.mockResolvedValue([{ _id: oid(), name: "Comp Off", accrualType: "yearly", defaultDaysPerYear: 0, carryForwardMode: "none" }]);
    LeaveRequest.find.mockReturnValue(makeSelectQuery([]));
    LeaveGrant.find.mockReturnValue(makeQuery([{ days: 1 }, { days: 0.5 }]));

    const res = mockRes();
    await getMyLeaveBalance({ user: employee }, res);

    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ accrued: 0, granted: 1.5, allocated: 1.5, remaining: 1.5 })]);
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
