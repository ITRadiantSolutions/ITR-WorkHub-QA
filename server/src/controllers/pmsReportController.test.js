import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Submission.js", () => ({
  default: { find: vi.fn() },
}));
vi.mock("xlsx", () => ({
  utils: {
    json_to_sheet: vi.fn(() => ({ __worksheet: true })),
    book_new: vi.fn(() => ({ __workbook: true })),
    book_append_sheet: vi.fn(),
  },
  write: vi.fn(() => Buffer.from("fake-xlsx-bytes")),
}));

import Submission from "../models/Submission.js";
import * as XLSX from "xlsx";
import { getCycleReport, exportCycleReport, getEmployeeReport } from "./pmsReportController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
};

const employeeUser = (id = oid()) => ({ _id: id, roles: { pms: "employee" } });
const managerUser = (id = oid()) => ({ _id: id, roles: { pms: "manager" } });
const hrUser = (id = oid()) => ({ _id: id, roles: { pms: "hr" } });

const findPopulateChain = (result) => ({ populate: vi.fn().mockResolvedValue(result) });

const buildSubmission = (overrides = {}) => ({
  employeeId: { name: "Alice", email: "a@corp.com" },
  status: "final_manager_reviewed",
  finalReport: { overallRating: 4, managerAvg: 4.5, oneOnOneDate: new Date("2026-07-10T00:00:00.000Z") },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCycleReport", () => {
  it("403s a non-hr caller", async () => {
    const req = { query: { cycleId: oid().toString() }, user: managerUser() };
    const res = mockRes();

    await getCycleReport(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Submission.find).not.toHaveBeenCalled();
  });

  it("400s when cycleId query param is missing", async () => {
    const req = { query: {}, user: hrUser() };
    const res = mockRes();

    await getCycleReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Submission.find).not.toHaveBeenCalled();
  });

  it("returns one row per submission in the cycle, with dates formatted as YYYY-MM-DD", async () => {
    const cycleId = oid();
    Submission.find.mockReturnValue(findPopulateChain([buildSubmission()]));
    const req = { query: { cycleId: cycleId.toString() }, user: hrUser() };
    const res = mockRes();

    await getCycleReport(req, res);

    expect(Submission.find).toHaveBeenCalledWith({ cycleId: cycleId.toString() });
    expect(res.json).toHaveBeenCalledWith([
      {
        Employee: "Alice",
        Email: "a@corp.com",
        Status: "final_manager_reviewed",
        SubmittedOn: "",
        OverallRating: 4,
        ManagerAvg: 4.5,
        OneOnOneDate: "2026-07-10",
      },
    ]);
  });

  it("renders an empty OneOnOneDate when it hasn't been set", async () => {
    Submission.find.mockReturnValue(findPopulateChain([buildSubmission({ finalReport: { overallRating: null, managerAvg: null, oneOnOneDate: null } })]));
    const req = { query: { cycleId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await getCycleReport(req, res);

    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ OneOnOneDate: "" })]);
  });

  it("formats submittedAt as SubmittedOn", async () => {
    Submission.find.mockReturnValue(
      findPopulateChain([buildSubmission({ submittedAt: new Date("2026-07-10T14:30:00.000Z") })]),
    );
    const req = { query: { cycleId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await getCycleReport(req, res);

    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ SubmittedOn: "2026-07-10 14:30" })]);
  });
});

describe("exportCycleReport", () => {
  it("403s a non-hr caller", async () => {
    const req = { query: { cycleId: oid().toString() }, user: employeeUser() };
    const res = mockRes();

    await exportCycleReport(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Submission.find).not.toHaveBeenCalled();
  });

  it("400s when cycleId query param is missing", async () => {
    const req = { query: {}, user: hrUser() };
    const res = mockRes();

    await exportCycleReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("builds an xlsx workbook from the cycle's rows and sends it as an attachment", async () => {
    Submission.find.mockReturnValue(findPopulateChain([buildSubmission()]));
    const req = { query: { cycleId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await exportCycleReport(req, res);

    expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith([expect.objectContaining({ Employee: "Alice" })]);
    expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith({ __workbook: true }, { __worksheet: true }, "PMS Report");
    expect(XLSX.write).toHaveBeenCalledWith({ __workbook: true }, { type: "buffer", bookType: "xlsx" });
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(res.setHeader).toHaveBeenCalledWith("Content-Disposition", 'attachment; filename="pms-cycle-report.xlsx"');
    expect(res.send).toHaveBeenCalledWith(Buffer.from("fake-xlsx-bytes"));
  });
});

describe("getEmployeeReport", () => {
  it("403s a caller who is neither hr nor the employee themselves", async () => {
    const req = { params: { employeeId: oid().toString() }, user: managerUser() };
    const res = mockRes();

    await getEmployeeReport(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Submission.find).not.toHaveBeenCalled();
  });

  it("lets hr view any employee's submissions across cycles", async () => {
    const submissions = [{ _id: oid(), cycleId: { name: "Q1", start: "2026-01-01", end: "2026-03-31" } }];
    Submission.find.mockReturnValue(findPopulateChain(submissions));
    const req = { params: { employeeId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await getEmployeeReport(req, res);

    expect(res.json).toHaveBeenCalledWith(submissions);
  });

  it("lets an employee view their own submission once its cycle's reportVisibility is 'all'", async () => {
    const userId = oid();
    const submissions = [
      {
        _id: oid(),
        cycleId: { name: "Q1", start: "2026-01-01", end: "2026-03-31", reportVisibility: { mode: "all", visibleTo: [] } },
      },
    ];
    Submission.find.mockReturnValue(findPopulateChain(submissions));
    const req = { params: { employeeId: userId.toString() }, user: employeeUser(userId) };
    const res = mockRes();

    await getEmployeeReport(req, res);

    expect(Submission.find).toHaveBeenCalledWith({ employeeId: userId.toString() });
    expect(res.json).toHaveBeenCalledWith(submissions);
  });

  // Fixed (doc §03 Phase 5 / §02 "View own finished report: Employee (once
  // visible)"): a per-cycle-submission is now filtered out unless HR's
  // reportVisibility grants this employee access.
  it("filters out a submission whose cycle reportVisibility.mode is 'none'", async () => {
    const userId = oid();
    const submissions = [
      {
        _id: oid(),
        status: "final_manager_reviewed",
        cycleId: { name: "Q1", start: "2026-01-01", end: "2026-03-31", reportVisibility: { mode: "none", visibleTo: [] } },
      },
    ];
    Submission.find.mockReturnValue(findPopulateChain(submissions));
    const req = { params: { employeeId: userId.toString() }, user: employeeUser(userId) };
    const res = mockRes();

    await getEmployeeReport(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it("includes a submission when reportVisibility.mode is 'selected' and the employee is on the list", async () => {
    const userId = oid();
    const submissions = [
      {
        _id: oid(),
        cycleId: { name: "Q1", start: "2026-01-01", end: "2026-03-31", reportVisibility: { mode: "selected", visibleTo: [userId] } },
      },
    ];
    Submission.find.mockReturnValue(findPopulateChain(submissions));
    const req = { params: { employeeId: userId.toString() }, user: employeeUser(userId) };
    const res = mockRes();

    await getEmployeeReport(req, res);

    expect(res.json).toHaveBeenCalledWith(submissions);
  });
});
