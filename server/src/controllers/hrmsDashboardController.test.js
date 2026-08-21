import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/User.js", () => ({ default: { countDocuments: vi.fn(), find: vi.fn() } }));
vi.mock("../models/JobPost.js", () => ({ default: { countDocuments: vi.fn() } }));
vi.mock("../models/JobRequest.js", () => ({ default: { countDocuments: vi.fn() } }));
vi.mock("../models/Referral.js", () => ({ default: { countDocuments: vi.fn() } }));
vi.mock("../models/LeaveRequest.js", () => ({ default: { countDocuments: vi.fn() } }));
vi.mock("../models/LeaveType.js", () => ({ default: { find: vi.fn() } }));
vi.mock("../models/Expense.js", () => ({ default: { countDocuments: vi.fn() } }));
vi.mock("../models/HrRequest.js", () => ({ default: { countDocuments: vi.fn() } }));
vi.mock("../models/AttendanceDay.js", () => ({ default: { aggregate: vi.fn() } }));
vi.mock("../models/AttendanceRegularization.js", () => ({ default: { countDocuments: vi.fn() } }));
vi.mock("../models/Payslip.js", () => ({ default: { countDocuments: vi.fn() } }));
vi.mock("../models/SalaryStructure.js", () => ({ default: { countDocuments: vi.fn() } }));
vi.mock("../models/CompanyHoliday.js", () => ({ default: { find: vi.fn(), findOne: vi.fn() } }));
vi.mock("../models/AssetAssignment.js", () => ({ default: { find: vi.fn() } }));
vi.mock("../models/EmployeeDocument.js", () => ({ default: { find: vi.fn() } }));

import User from "../models/User.js";
import JobPost from "../models/JobPost.js";
import JobRequest from "../models/JobRequest.js";
import Referral from "../models/Referral.js";
import LeaveRequest from "../models/LeaveRequest.js";
import LeaveType from "../models/LeaveType.js";
import Expense from "../models/Expense.js";
import HrRequest from "../models/HrRequest.js";
import AttendanceDay from "../models/AttendanceDay.js";
import AttendanceRegularization from "../models/AttendanceRegularization.js";
import Payslip from "../models/Payslip.js";
import SalaryStructure from "../models/SalaryStructure.js";
import CompanyHoliday from "../models/CompanyHoliday.js";
import AssetAssignment from "../models/AssetAssignment.js";
import EmployeeDocument from "../models/EmployeeDocument.js";
import { getDashboardStats } from "./hrmsDashboardController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const makeSelectQuery = (result) => ({ select: vi.fn().mockResolvedValue(result) });
const makeSelectSortQuery = (result) => ({ select: vi.fn().mockReturnValue({ sort: vi.fn().mockResolvedValue(result) }) });
const makePopulateSortQuery = (result) => ({ populate: vi.fn().mockReturnValue({ sort: vi.fn().mockResolvedValue(result) }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-15T00:00:00Z"));

  User.countDocuments.mockResolvedValue(0);
  JobPost.countDocuments.mockResolvedValue(0);
  JobRequest.countDocuments.mockResolvedValue(0);
  Referral.countDocuments.mockResolvedValue(0);
  LeaveRequest.countDocuments.mockResolvedValue(0);
  LeaveType.find.mockReturnValue(makeSelectQuery([]));
  Expense.countDocuments.mockResolvedValue(0);
  HrRequest.countDocuments.mockResolvedValue(0);
  AttendanceDay.aggregate.mockResolvedValue([]);
  AttendanceRegularization.countDocuments.mockResolvedValue(0);
  Payslip.countDocuments.mockResolvedValue(0);
  SalaryStructure.countDocuments.mockResolvedValue(0);
  CompanyHoliday.find.mockReturnValue(makeSelectSortQuery([]));
  CompanyHoliday.findOne.mockReturnValue(makeSelectSortQuery(null));
  AssetAssignment.find.mockReturnValue(makePopulateSortQuery([]));
  EmployeeDocument.find.mockReturnValue(makeSelectSortQuery([]));
  User.find.mockReturnValue(makeSelectQuery([]));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getDashboardStats — hr role", () => {
  it("aggregates company-wide pending-approval counts and attendance", async () => {
    LeaveRequest.countDocuments.mockResolvedValue(4);
    Expense.countDocuments.mockResolvedValue(2);
    HrRequest.countDocuments.mockResolvedValue(3);
    AttendanceRegularization.countDocuments.mockResolvedValue(1);
    AttendanceDay.aggregate.mockResolvedValue([{ _id: "present", count: 40 }, { _id: "absent", count: 2 }]);
    SalaryStructure.countDocuments.mockResolvedValue(50);
    Payslip.countDocuments.mockResolvedValue(30);

    const req = { user: { _id: oid(), roles: { hrms: "hr" } } };
    const res = mockRes();
    await getDashboardStats(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      role: "hr",
      pendingLeaveApprovals: 4,
      pendingExpenseApprovals: 2,
      openHrRequests: 3,
      pendingRegularizations: 1,
      attendanceToday: { present: 40, absent: 2 },
      payrollStatus: { totalStructures: 50, generated: 30 },
    }));
  });

  it("scopes today's attendance aggregate to the current calendar date", async () => {
    const req = { user: { _id: oid(), roles: { hrms: "hr" } } };
    await getDashboardStats(req, mockRes());

    expect(AttendanceDay.aggregate).toHaveBeenCalledWith([
      { $match: { date: "2026-08-15" } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
  });

  it("includes an employee whose birthday is within the next 7 days, wrapping into next year", async () => {
    // "Today" is 2026-08-15; a birthday of Aug 20 is 5 days away.
    User.find.mockReturnValue(makeSelectQuery([
      { name: "Soon Birthday", dateOfBirth: new Date("1990-08-20") },
      { name: "Far Birthday", dateOfBirth: new Date("1990-01-01") },
    ]));

    const req = { user: { _id: oid(), roles: { hrms: "hr" } } };
    const res = mockRes();
    await getDashboardStats(req, res);

    const [payload] = res.json.mock.calls[0];
    expect(payload.birthdays).toHaveLength(1);
    expect(payload.birthdays[0]).toMatchObject({ name: "Soon Birthday", daysAway: 5 });
  });

  it("falls back to the single next holiday when none fall within the 30-day window", async () => {
    CompanyHoliday.find.mockReturnValue(makeSelectSortQuery([]));
    CompanyHoliday.findOne.mockReturnValue(makeSelectSortQuery({ date: "2026-12-25", label: "Christmas Day" }));

    const req = { user: { _id: oid(), roles: { hrms: "hr" } } };
    const res = mockRes();
    await getDashboardStats(req, res);

    const [payload] = res.json.mock.calls[0];
    expect(payload.holidays).toEqual([{ date: "2026-12-25", label: "Christmas Day" }]);
  });

  it("returns no holidays when none exist at all, rather than throwing", async () => {
    CompanyHoliday.find.mockReturnValue(makeSelectSortQuery([]));
    CompanyHoliday.findOne.mockReturnValue(makeSelectSortQuery(null));

    const req = { user: { _id: oid(), roles: { hrms: "hr" } } };
    const res = mockRes();
    await getDashboardStats(req, res);

    const [payload] = res.json.mock.calls[0];
    expect(payload.holidays).toEqual([]);
  });

  it("includes an employee whose work anniversary is within the next 7 days, and excludes one who joined this year", async () => {
    // "Today" is 2026-08-15; joiningDate of 2024-08-20 is 5 days away and a
    // real (2nd) anniversary. joiningDate of 2026-08-18 is only 3 days away
    // but is this calendar year's hire — not an anniversary yet.
    User.find.mockReturnValue(makeSelectQuery([
      { name: "Veteran", joiningDate: new Date("2024-08-20") },
      { name: "New Hire", joiningDate: new Date("2026-08-18") },
    ]));

    const req = { user: { _id: oid(), roles: { hrms: "hr" } } };
    const res = mockRes();
    await getDashboardStats(req, res);

    const [payload] = res.json.mock.calls[0];
    expect(payload.workAnniversaries).toHaveLength(1);
    expect(payload.workAnniversaries[0]).toMatchObject({ name: "Veteran", daysAway: 5, years: 2 });
  });
});

describe("getDashboardStats — manager role", () => {
  it("scopes pending approvals and attendance to direct + skip-level reports", async () => {
    const manager = { _id: oid(), roles: { hrms: "manager" } };
    const directReportId = oid();
    const skipLevelReportId = oid();
    User.find
      .mockReturnValueOnce(makeSelectQuery([{ _id: directReportId }])) // directReports
      .mockReturnValueOnce(makeSelectQuery([{ _id: skipLevelReportId }])) // skipLevelReports
      .mockReturnValueOnce(makeSelectQuery([])) // birthdays lookup
      .mockReturnValueOnce(makeSelectQuery([])); // work anniversaries lookup

    const req = { user: manager };
    await getDashboardStats(req, mockRes());

    expect(LeaveRequest.countDocuments).toHaveBeenCalledWith({
      employee: { $in: [directReportId, skipLevelReportId] },
      status: { $in: ["pending_manager", "pending_skip_level"] },
    });
    expect(Expense.countDocuments).toHaveBeenCalledWith({ employee: { $in: [directReportId] }, status: "submitted" });
  });
});

describe("getDashboardStats — employee role", () => {
  it("sums the employee's own pending requests across leave/expense/HR requests", async () => {
    LeaveRequest.countDocuments.mockResolvedValue(1);
    Expense.countDocuments.mockResolvedValue(2);
    HrRequest.countDocuments.mockResolvedValue(1);

    const req = { user: { _id: oid(), roles: { hrms: "employee" } } };
    const res = mockRes();
    await getDashboardStats(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ role: "employee", myPendingRequests: 4 }));
  });

  it("includes the employee's own active asset assignments and documents, scoped to their id", async () => {
    const employeeId = oid();
    AssetAssignment.find.mockReturnValue(makePopulateSortQuery([
      { _id: oid(), asset: { name: "MacBook Pro", assetTag: "AST-001", category: "laptop" } },
    ]));
    EmployeeDocument.find.mockReturnValue(makeSelectSortQuery([
      { _id: oid(), title: "Offer Letter", category: "offer_letter", createdAt: new Date("2026-01-01") },
    ]));

    const req = { user: { _id: employeeId, roles: { hrms: "employee" } } };
    const res = mockRes();
    await getDashboardStats(req, res);

    expect(AssetAssignment.find).toHaveBeenCalledWith({ employee: employeeId, status: "active" });
    expect(EmployeeDocument.find).toHaveBeenCalledWith({ employee: employeeId });

    const [payload] = res.json.mock.calls[0];
    expect(payload.myAssets[0]).toMatchObject({ name: "MacBook Pro", assetTag: "AST-001", category: "laptop" });
    expect(payload.myDocuments[0]).toMatchObject({ title: "Offer Letter" });
  });
});
