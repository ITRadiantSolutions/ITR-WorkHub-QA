import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/AttendancePunch.js", () => ({
  default: { find: vi.fn(), findOneAndUpdate: vi.fn(), create: vi.fn() },
}));
vi.mock("../models/AttendanceDay.js", () => ({
  default: { find: vi.fn(), findOneAndUpdate: vi.fn(), findById: vi.fn(), countDocuments: vi.fn(), aggregate: vi.fn() },
}));
vi.mock("../models/AttendanceRegularization.js", () => ({
  default: { find: vi.fn(), findOne: vi.fn(), findById: vi.fn(), create: vi.fn() },
}));
vi.mock("../models/User.js", () => ({ default: { findOne: vi.fn(), findById: vi.fn(), find: vi.fn(), countDocuments: vi.fn() } }));
vi.mock("../models/CompanyHoliday.js", () => ({ default: { findOne: vi.fn() } }));
vi.mock("../models/LeaveRequest.js", () => ({ default: { findOne: vi.fn() } }));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("../utils/notify.js", () => ({ notifyUsers: vi.fn() }));
vi.mock("../utils/hrmsMailer.js", () => ({ sendHrmsEmail: vi.fn() }));

import AttendancePunch from "../models/AttendancePunch.js";
import AttendanceDay from "../models/AttendanceDay.js";
import AttendanceRegularization from "../models/AttendanceRegularization.js";
import User from "../models/User.js";
import CompanyHoliday from "../models/CompanyHoliday.js";
import LeaveRequest from "../models/LeaveRequest.js";
import { writeAuditLog } from "../utils/activityLog.js";
import { notifyUsers } from "../utils/notify.js";
import { sendHrmsEmail } from "../utils/hrmsMailer.js";
import {
  computeDayFields,
  recordPunch,
  manualPunch,
  regularizeDay,
  createRegularizationRequest,
  listTeamRegularizationRequests,
  reviewRegularizationRequest,
} from "./hrmsAttendanceController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const makeSelectQuery = (result) => ({ select: vi.fn().mockResolvedValue(result) });

const makeQuery = (result) => {
  const query = {};
  query.populate = vi.fn().mockReturnValue(query);
  query.sort = vi.fn().mockResolvedValue(result);
  query.then = (resolve) => resolve(result);
  return query;
};

const hrUser = () => ({ _id: oid(), name: "Helen HR", roles: { hrms: "hr" } });
const managerUser = () => ({ _id: oid(), name: "Mo Manager", roles: { hrms: "manager" } });
const employeeUser = (managerId = null) => ({ _id: oid(), name: "Eve Employee", managerId, roles: { hrms: "employee" } });

beforeEach(() => {
  vi.clearAllMocks();
  CompanyHoliday.findOne.mockReturnValue(makeSelectQuery(null));
  LeaveRequest.findOne.mockReturnValue(makeSelectQuery(null));
  AttendancePunch.find.mockReturnValue(makeSelectQuery([]));
});

describe("computeDayFields", () => {
  const base = { isHoliday: false, isOnLeave: false, isWeekendDay: false };

  it("marks a day with no punches as absent on a working day", () => {
    expect(computeDayFields([], base).status).toBe("absent");
  });

  it("marks weekend regardless of punches", () => {
    const result = computeDayFields([], { ...base, isWeekendDay: true });
    expect(result.status).toBe("weekend");
  });

  it("marks holiday ahead of absent", () => {
    expect(computeDayFields([], { ...base, isHoliday: true }).status).toBe("holiday");
  });

  it("marks on_leave when an approved leave covers the date", () => {
    expect(computeDayFields([], { ...base, isOnLeave: true }).status).toBe("on_leave");
  });

  it("computes present for >=8h between first and last punch", () => {
    const punches = [{ timestamp: "2026-08-19T09:00:00" }, { timestamp: "2026-08-19T18:00:00" }];
    const result = computeDayFields(punches, base);
    expect(result.status).toBe("present");
    expect(result.workedSeconds).toBe(9 * 3600);
    expect(result.punchCount).toBe(2);
  });

  it("computes half_day for a short gap between punches", () => {
    const punches = [{ timestamp: "2026-08-19T09:00:00" }, { timestamp: "2026-08-19T12:00:00" }];
    expect(computeDayFields(punches, base).status).toBe("half_day");
  });

  it("treats a single punch as half_day, not present", () => {
    const punches = [{ timestamp: "2026-08-19T09:00:00" }];
    const result = computeDayFields(punches, base);
    expect(result.status).toBe("half_day");
    expect(result.workedSeconds).toBe(0);
  });

  it("flags isLate when the first punch is after 09:30", () => {
    const punches = [{ timestamp: "2026-08-19T10:15:00" }, { timestamp: "2026-08-19T18:00:00" }];
    expect(computeDayFields(punches, base).isLate).toBe(true);
  });

  it("does not flag isLate before the cutoff", () => {
    const punches = [{ timestamp: "2026-08-19T09:00:00" }, { timestamp: "2026-08-19T18:00:00" }];
    expect(computeDayFields(punches, base).isLate).toBe(false);
  });
});

describe("recordPunch", () => {
  it("400s when employeeCode or timestamp is missing", async () => {
    const req = { body: { direction: "IN" } };
    const res = mockRes();
    await recordPunch(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(AttendancePunch.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("400s an unparseable timestamp", async () => {
    const req = { body: { employeeCode: "EMP1001", timestamp: "not-a-date" } };
    const res = mockRes();
    await recordPunch(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("stores a matched punch and recomputes the day", async () => {
    const employee = { _id: oid() };
    User.findOne.mockReturnValue(makeSelectQuery(employee));
    const punch = { _id: oid() };
    AttendancePunch.findOneAndUpdate.mockResolvedValue(punch);
    AttendanceDay.findOneAndUpdate.mockResolvedValue({ _id: oid(), status: "present" });

    const req = {
      body: {
        employeeCode: "EMP1001",
        timestamp: "2026-08-19 09:02:31",
        direction: "0",
        deviceSerial: "SN123",
        devicePin: "1",
        source: "ESSL_AIFACE_MAGNUM",
      },
    };
    const res = mockRes();
    await recordPunch(req, res);

    expect(User.findOne).toHaveBeenCalledWith({ employeeId: "EMP1001" });
    expect(AttendancePunch.findOneAndUpdate).toHaveBeenCalledWith(
      { dedupKey: expect.any(String) },
      expect.objectContaining({ $setOnInsert: expect.objectContaining({ employee: employee._id, direction: "UNKNOWN" }) }),
      { upsert: true, new: true },
    );
    expect(AttendanceDay.findOneAndUpdate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, matched: true }));
  });

  it("still stores an unmapped punch (2xx) so the connector doesn't retry forever", async () => {
    User.findOne.mockReturnValue(makeSelectQuery(null));
    AttendancePunch.findOneAndUpdate.mockResolvedValue({ _id: oid() });

    const req = { body: { employeeCode: "GHOST", timestamp: "2026-08-19 09:00:00" } };
    const res = mockRes();
    await recordPunch(req, res);

    expect(AttendanceDay.findOneAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ matched: false }));
  });
});

describe("manualPunch", () => {
  it("404s an unknown employee", async () => {
    User.findById.mockReturnValue(makeSelectQuery(null));
    const req = { body: { employeeId: oid().toString(), timestamp: "2026-08-19T09:00:00" }, user: hrUser() };
    const res = mockRes();

    await manualPunch(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(AttendancePunch.create).not.toHaveBeenCalled();
  });

  it("creates a manual punch, recomputes the day, and audit-logs it", async () => {
    const employee = { _id: oid(), employeeId: "EMP1001" };
    User.findById.mockReturnValue(makeSelectQuery(employee));
    const punch = { _id: oid() };
    AttendancePunch.create.mockResolvedValue(punch);
    AttendanceDay.findOneAndUpdate.mockResolvedValue({ _id: oid() });

    const hr = hrUser();
    const req = { body: { employeeId: employee._id.toString(), timestamp: "2026-08-19T09:00:00", direction: "IN" }, user: hr };
    const res = mockRes();

    await manualPunch(req, res);

    expect(AttendancePunch.create).toHaveBeenCalledWith(expect.objectContaining({ employee: employee._id, source: "MANUAL", createdBy: hr._id }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ event: "hrms.attendance.manualPunch" }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("regularizeDay", () => {
  it("400s an invalid status", async () => {
    const req = { params: { id: oid().toString() }, body: { status: "on_vacation" }, user: hrUser() };
    const res = mockRes();
    await regularizeDay(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("404s a missing record", async () => {
    AttendanceDay.findById.mockResolvedValueOnce(null);
    const req = { params: { id: oid().toString() }, body: { status: "present" }, user: hrUser() };
    const res = mockRes();
    await regularizeDay(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("overrides status, marks regularized, audit-logs, and notifies the employee", async () => {
    const employeeId = oid();
    const day = { _id: oid(), employee: employeeId, date: "2026-08-19", status: "absent", isRegularized: false, save: vi.fn() };
    AttendanceDay.findById
      .mockResolvedValueOnce(day)
      .mockReturnValueOnce({ populate: vi.fn().mockResolvedValue(day) });

    const hr = hrUser();
    const req = { params: { id: day._id.toString() }, body: { status: "present", note: "Device was offline" }, user: hr };
    const res = mockRes();

    await regularizeDay(req, res);

    expect(day.status).toBe("present");
    expect(day.isRegularized).toBe(true);
    expect(day.regularizedBy).toBe(hr._id);
    expect(day.save).toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ event: "hrms.attendance.regularized" }));
    expect(notifyUsers).toHaveBeenCalledWith([employeeId], expect.objectContaining({ type: "attendanceRegularized" }));
  });
});

describe("createRegularizationRequest", () => {
  it("400s a missing date or invalid requestedStatus", async () => {
    const req = { body: { requestedStatus: "on_vacation", reason: "x" }, user: employeeUser() };
    const res = mockRes();
    await createRegularizationRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(AttendanceRegularization.create).not.toHaveBeenCalled();
  });

  it("400s a missing reason", async () => {
    const req = { body: { date: "2026-08-19", requestedStatus: "present" }, user: employeeUser() };
    const res = mockRes();
    await createRegularizationRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("409s when a pending request already exists for that date", async () => {
    AttendanceRegularization.findOne.mockResolvedValue({ _id: oid(), status: "pending" });
    const req = { body: { date: "2026-08-19", requestedStatus: "present", reason: "Forgot to swipe" }, user: employeeUser() };
    const res = mockRes();
    await createRegularizationRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("creates a request and notifies the manager", async () => {
    const manager = managerUser();
    const employee = employeeUser(manager._id);
    AttendanceRegularization.findOne.mockResolvedValue(null);
    const created = { _id: oid() };
    AttendanceRegularization.create.mockResolvedValue(created);
    AttendanceRegularization.findById.mockReturnValue(makeQuery({ _id: created._id, status: "pending" }));

    const req = { body: { date: "2026-08-19", requestedStatus: "present", reason: "Forgot to swipe" }, user: employee };
    const res = mockRes();

    await createRegularizationRequest(req, res);

    expect(AttendanceRegularization.create).toHaveBeenCalledWith(
      expect.objectContaining({ employee: employee._id, date: "2026-08-19", requestedStatus: "present", reason: "Forgot to swipe" }),
    );
    expect(notifyUsers).toHaveBeenCalledWith([manager._id], expect.objectContaining({ type: "attendanceRegularizationRequested" }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("falls back to notifying HR when the employee has no manager", async () => {
    AttendanceRegularization.findOne.mockResolvedValue(null);
    AttendanceRegularization.create.mockResolvedValue({ _id: oid() });
    AttendanceRegularization.findById.mockReturnValue(makeQuery({}));
    const hrIds = [oid()];
    User.find.mockReturnValue({ select: vi.fn().mockResolvedValue(hrIds.map((id) => ({ _id: id }))) });

    const req = { body: { date: "2026-08-19", requestedStatus: "present", reason: "Forgot to swipe" }, user: employeeUser(null) };
    await createRegularizationRequest(req, mockRes());

    expect(notifyUsers).toHaveBeenCalledWith(hrIds, expect.objectContaining({ type: "attendanceRegularizationRequested" }));
  });
});

describe("listTeamRegularizationRequests", () => {
  it("scopes to the manager's direct reports", async () => {
    const manager = managerUser();
    const reportIds = [oid(), oid()];
    User.find.mockReturnValue({ select: vi.fn().mockResolvedValue(reportIds.map((id) => ({ _id: id }))) });
    AttendanceRegularization.find.mockReturnValue(makeQuery([]));

    const req = { user: manager };
    await listTeamRegularizationRequests(req, mockRes());

    expect(User.find).toHaveBeenCalledWith({ managerId: manager._id });
    expect(AttendanceRegularization.find).toHaveBeenCalledWith({ employee: { $in: reportIds } });
  });
});

describe("reviewRegularizationRequest", () => {
  const pendingRequest = (employee) => ({
    _id: oid(),
    employee,
    date: "2026-08-19",
    requestedStatus: "present",
    requestedFirstIn: null,
    requestedLastOut: null,
    reason: "Forgot to swipe",
    status: "pending",
    save: vi.fn(),
  });

  it("400s an invalid action", async () => {
    const req = { params: { id: oid().toString() }, body: { action: "approveish" }, user: hrUser() };
    const res = mockRes();
    await reviewRegularizationRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(AttendanceRegularization.findById).not.toHaveBeenCalled();
  });

  it("404s a missing request", async () => {
    AttendanceRegularization.findById.mockReturnValue(makeQuery(null));
    const req = { params: { id: oid().toString() }, body: { action: "approve" }, user: hrUser() };
    const res = mockRes();
    await reviewRegularizationRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403s a manager who isn't the employee's manager", async () => {
    const employee = employeeUser(oid());
    const request = pendingRequest(employee);
    AttendanceRegularization.findById.mockReturnValue(makeQuery(request));
    const req = { params: { id: request._id.toString() }, body: { action: "approve" }, user: managerUser() };
    const res = mockRes();
    await reviewRegularizationRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("409s a request that was already decided", async () => {
    const manager = managerUser();
    const employee = employeeUser(manager._id);
    const request = { ...pendingRequest(employee), status: "approved" };
    AttendanceRegularization.findById.mockReturnValue(makeQuery(request));
    const req = { params: { id: request._id.toString() }, body: { action: "approve" }, user: manager };
    const res = mockRes();
    await reviewRegularizationRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("on approve, writes the correction into AttendanceDay and notifies the employee", async () => {
    const manager = managerUser();
    const employee = { ...employeeUser(manager._id), email: "eve@example.com" };
    const request = pendingRequest(employee);
    AttendanceRegularization.findById.mockReturnValue(makeQuery(request));
    AttendanceDay.findOneAndUpdate.mockResolvedValue({ _id: oid() });

    const req = { params: { id: request._id.toString() }, body: { action: "approve", comment: "Looks right" }, user: manager };
    const res = mockRes();
    await reviewRegularizationRequest(req, res);

    expect(request.status).toBe("approved");
    expect(request.save).toHaveBeenCalled();
    expect(AttendanceDay.findOneAndUpdate).toHaveBeenCalledWith(
      { employee: employee._id, date: "2026-08-19" },
      expect.objectContaining({ $set: expect.objectContaining({ status: "present", isRegularized: true }) }),
      { upsert: true },
    );
    expect(notifyUsers).toHaveBeenCalledWith([employee._id], expect.objectContaining({ type: "attendanceRegularizationApproved" }));
    expect(sendHrmsEmail).toHaveBeenCalledWith(employee.email, expect.any(String), expect.any(String), expect.any(String));
    expect(res.json).toHaveBeenCalledWith(request);
  });

  it("on approve with both requested times, computes workedSeconds from them", async () => {
    const manager = managerUser();
    const employee = { ...employeeUser(manager._id), email: "eve@example.com" };
    const request = {
      ...pendingRequest(employee),
      requestedFirstIn: new Date("2026-08-18T09:10:00"),
      requestedLastOut: new Date("2026-08-18T18:20:00"),
    };
    AttendanceRegularization.findById.mockReturnValue(makeQuery(request));
    AttendanceDay.findOneAndUpdate.mockResolvedValue({ _id: oid() });

    const req = { params: { id: request._id.toString() }, body: { action: "approve" }, user: manager };
    await reviewRegularizationRequest(req, mockRes());

    expect(AttendanceDay.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ $set: expect.objectContaining({ workedSeconds: 9 * 3600 + 10 * 60 }) }),
      { upsert: true },
    );
  });

  it("on reject, leaves AttendanceDay untouched", async () => {
    const manager = managerUser();
    const employee = { ...employeeUser(manager._id), email: "eve@example.com" };
    const request = pendingRequest(employee);
    AttendanceRegularization.findById.mockReturnValue(makeQuery(request));

    const req = { params: { id: request._id.toString() }, body: { action: "reject", comment: "Not enough evidence" }, user: manager };
    await reviewRegularizationRequest(req, mockRes());

    expect(request.status).toBe("rejected");
    expect(AttendanceDay.findOneAndUpdate).not.toHaveBeenCalled();
    expect(notifyUsers).toHaveBeenCalledWith([employee._id], expect.objectContaining({ type: "attendanceRegularizationRejected" }));
  });
});
