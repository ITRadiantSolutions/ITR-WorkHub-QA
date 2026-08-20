import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/AttendancePunch.js", () => ({
  default: { find: vi.fn(), findOneAndUpdate: vi.fn(), create: vi.fn() },
}));
vi.mock("../models/AttendanceDay.js", () => ({
  default: { find: vi.fn(), findOneAndUpdate: vi.fn(), findById: vi.fn(), countDocuments: vi.fn(), aggregate: vi.fn() },
}));
vi.mock("../models/User.js", () => ({ default: { findOne: vi.fn(), findById: vi.fn(), find: vi.fn(), countDocuments: vi.fn() } }));
vi.mock("../models/CompanyHoliday.js", () => ({ default: { findOne: vi.fn() } }));
vi.mock("../models/LeaveRequest.js", () => ({ default: { findOne: vi.fn() } }));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("../utils/notify.js", () => ({ notifyUsers: vi.fn() }));

import AttendancePunch from "../models/AttendancePunch.js";
import AttendanceDay from "../models/AttendanceDay.js";
import User from "../models/User.js";
import CompanyHoliday from "../models/CompanyHoliday.js";
import LeaveRequest from "../models/LeaveRequest.js";
import { writeAuditLog } from "../utils/activityLog.js";
import { notifyUsers } from "../utils/notify.js";
import {
  computeDayFields,
  recordPunch,
  manualPunch,
  regularizeDay,
} from "./hrmsAttendanceController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const makeSelectQuery = (result) => ({ select: vi.fn().mockResolvedValue(result) });

const hrUser = () => ({ _id: oid(), name: "Helen HR", roles: { hrms: "hr" } });

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
