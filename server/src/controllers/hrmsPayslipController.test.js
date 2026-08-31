import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Payslip.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findById: vi.fn() },
}));
vi.mock("../models/SalaryStructure.js", () => ({
  default: { findOne: vi.fn(), find: vi.fn() },
}));
vi.mock("../models/User.js", () => ({ default: { findById: vi.fn() } }));
vi.mock("../models/LeaveRequest.js", () => ({ default: { find: vi.fn() } }));
vi.mock("../models/Offboarding.js", () => ({ default: { findOne: vi.fn() } }));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("../utils/notify.js", () => ({ notifyUsers: vi.fn() }));
vi.mock("../utils/hrmsMailer.js", () => ({ sendHrmsEmail: vi.fn() }));
vi.mock("pdfkit", () => {
  // Real pdfkit tracks a cursor via the settable `y` property (our layout
  // code both reads and assigns doc.y), so a getter-only stub isn't enough.
  class FakePDFDocument {
    constructor() { this._y = 100; this._handlers = {}; }
    pipe() { return this; }
    fontSize() { return this; }
    font() { return this; }
    fillColor() { return this; }
    strokeColor() { return this; }
    text() { return this; }
    moveDown() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    stroke() { return this; }
    image() { return this; }
    on(event, handler) { this._handlers[event] = handler; return this; }
    end() {
      // Mimics the buffer-rendering path (renderPayslipPdfBuffer): emit one
      // data chunk then end, synchronously, so tests can await the Promise.
      this._handlers.data?.(Buffer.from("fake-pdf-bytes"));
      this._handlers.end?.();
      return this;
    }
    get y() { return this._y; }
    set y(value) { this._y = value; }
  }
  return { default: FakePDFDocument };
});

import Payslip from "../models/Payslip.js";
import SalaryStructure from "../models/SalaryStructure.js";
import User from "../models/User.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Offboarding from "../models/Offboarding.js";
import { notifyUsers } from "../utils/notify.js";
import { sendHrmsEmail } from "../utils/hrmsMailer.js";
import {
  generatePayslip,
  generateBulkPayslips,
  listMyPayslips,
  listPayslips,
  markPayslipPaid,
  getPayslipPdf,
} from "./hrmsPayslipController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
};

const hrUser = () => ({ _id: oid(), roles: { hrms: "hr" } });

// notifyPayslipGenerated renders the PDF (for the email attachment) on a
// fire-and-forget .then()/.catch() chain, deliberately not awaited by the
// controller so a slow render never delays the HTTP response — flush the
// microtask queue so that background work settles before asserting on it.
const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

// Enough fields for drawPayslipPdf to render without throwing — Payslip.create
// is mocked, so nothing here needs to be a real Mongoose document.
const fullPayslip = (overrides = {}) => ({
  _id: oid(), month: 8, year: 2026, status: "generated",
  components: [{ name: "Basic", type: "earning", amount: 1000 }],
  grossEarnings: 1000, totalContributions: 0, totalDeductions: 0, netPay: 1000,
  employeeNumber: "", department: "", designation: "", location: "", paymentMode: "bank_transfer",
  uan: "", panNumber: "", dateOfBirth: null, monthlySalary: 0,
  totalWorkingDays: 31, lossOfPayDays: 0, actualPayableDays: 31, daysPayable: 31,
  ...overrides,
});

// User.findById(...).select(...).populate("locationId", "name") — resolves
// directly, since the controller always awaits the full chain.
const makeUserQuery = (result) => {
  const query = {};
  query.select = vi.fn().mockReturnValue(query);
  query.populate = vi.fn().mockResolvedValue(result);
  return query;
};

beforeEach(() => {
  vi.clearAllMocks();
  LeaveRequest.find.mockReturnValue({ select: vi.fn().mockResolvedValue([]) });
  Offboarding.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
});

describe("generatePayslip", () => {
  it("400s an invalid month", async () => {
    const req = { body: { employeeId: oid().toString(), month: 13, year: 2026 }, user: hrUser() };
    const res = mockRes();

    await generatePayslip(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(SalaryStructure.findOne).not.toHaveBeenCalled();
  });

  it("404s when the employee has no salary structure", async () => {
    SalaryStructure.findOne.mockResolvedValue(null);
    User.findById.mockReturnValue(makeUserQuery({ _id: oid(), name: "Eve", email: "eve@example.com" }));
    const req = { body: { employeeId: oid().toString(), month: 8, year: 2026 }, user: hrUser() };
    const res = mockRes();

    await generatePayslip(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("computes gross/contributions/deductions/net, snapshots profile fields, and notifies + emails the employee", async () => {
    const employeeId = oid();
    SalaryStructure.findOne.mockResolvedValue({
      components: [
        { name: "Basic", type: "earning", amount: 50000 },
        { name: "HRA", type: "earning", amount: 10000 },
        { name: "PF Employee", type: "contribution", amount: 1800 },
        { name: "Professional Tax", type: "deduction", amount: 200 },
      ],
      paymentMode: "bank_transfer",
      uan: "101655166440",
      monthlySalary: 60000,
    });
    User.findById.mockReturnValue(makeUserQuery({
      _id: employeeId, name: "Eve", email: "eve@example.com", employeeId: "EMP1001",
      department: "Engineering", designation: "Developer", panNumber: "ABCDE1234F",
      dateOfBirth: new Date("1999-08-02"), locationId: { name: "Hyderabad" },
    }));
    Payslip.create.mockResolvedValue(fullPayslip({ employee: employeeId, netPay: 58000 }));

    const req = { body: { employeeId: employeeId.toString(), month: 8, year: 2026 }, user: hrUser() };
    const res = mockRes();

    await generatePayslip(req, res);
    await flushMicrotasks();

    expect(Payslip.create).toHaveBeenCalledWith(
      expect.objectContaining({
        grossEarnings: 60000, totalContributions: 1800, totalDeductions: 200, netPay: 58000,
        employeeNumber: "EMP1001", department: "Engineering", designation: "Developer",
        location: "Hyderabad", panNumber: "ABCDE1234F", uan: "101655166440", monthlySalary: 60000,
        totalWorkingDays: 31, lossOfPayDays: 0, actualPayableDays: 31, daysPayable: 31,
      }),
    );
    expect(notifyUsers).toHaveBeenCalledWith([employeeId], expect.objectContaining({ type: "payslipGenerated" }));
    expect(sendHrmsEmail).toHaveBeenCalledWith(
      "eve@example.com", expect.any(String), expect.any(String), expect.any(String),
      [expect.objectContaining({ filename: expect.stringContaining(".pdf"), content: expect.any(Buffer), contentType: "application/pdf" })],
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("attributes a month's loss-of-pay days from approved leave requests starting that month, and prorates earnings by it", async () => {
    const employeeId = oid();
    SalaryStructure.findOne.mockResolvedValue({ components: [{ name: "Basic", type: "earning", amount: 30000 }] });
    User.findById.mockReturnValue(makeUserQuery({ _id: employeeId, name: "Eve", email: "eve@example.com" }));
    LeaveRequest.find.mockReturnValue({ select: vi.fn().mockResolvedValue([{ lopDays: 1.5 }, { lopDays: 2 }]) });
    Payslip.create.mockResolvedValue(fullPayslip());

    const req = { body: { employeeId: employeeId.toString(), month: 8, year: 2026 }, user: hrUser() };
    await generatePayslip(req, mockRes());
    await flushMicrotasks();

    // 31 calendar days - 3.5 LOP = 27.5 payable; earnings scale by 27.5/31.
    expect(Payslip.create).toHaveBeenCalledWith(
      expect.objectContaining({
        lossOfPayDays: 3.5, totalWorkingDays: 31, actualPayableDays: 27.5, daysPayable: 27.5,
        grossEarnings: 26612.9, netPay: 26612.9,
      }),
    );
  });

  it("prorates earnings for an employee who joined partway through the month, not just displays it", async () => {
    const employeeId = oid();
    // 31000/31 = a clean 1000/day, so the expected prorated amount is exact.
    SalaryStructure.findOne.mockResolvedValue({ components: [{ name: "Basic", type: "earning", amount: 31000 }] });
    User.findById.mockReturnValue(makeUserQuery({ _id: employeeId, name: "Eve", email: "eve@example.com", joiningDate: new Date("2026-08-15") }));
    Payslip.create.mockResolvedValue(fullPayslip());

    const req = { body: { employeeId: employeeId.toString(), month: 8, year: 2026 }, user: hrUser() };
    await generatePayslip(req, mockRes());
    await flushMicrotasks();

    // Aug 15-31 inclusive = 17 employed days out of 31.
    expect(Payslip.create).toHaveBeenCalledWith(
      expect.objectContaining({ totalWorkingDays: 31, actualPayableDays: 17, daysPayable: 17, grossEarnings: 17000, netPay: 17000 }),
    );
  });

  it("prorates earnings for an employee who left partway through the month, per their offboarding record", async () => {
    const employeeId = oid();
    SalaryStructure.findOne.mockResolvedValue({ components: [{ name: "Basic", type: "earning", amount: 31000 }] });
    User.findById.mockReturnValue(makeUserQuery({ _id: employeeId, name: "Eve", email: "eve@example.com" }));
    Offboarding.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ lastWorkingDate: new Date("2026-08-20") }) });
    Payslip.create.mockResolvedValue(fullPayslip());

    const req = { body: { employeeId: employeeId.toString(), month: 8, year: 2026 }, user: hrUser() };
    await generatePayslip(req, mockRes());
    await flushMicrotasks();

    // Aug 1-20 inclusive = 20 employed days out of 31.
    expect(Payslip.create).toHaveBeenCalledWith(
      expect.objectContaining({ totalWorkingDays: 31, actualPayableDays: 20, daysPayable: 20, grossEarnings: 20000, netPay: 20000 }),
    );
  });

  it("pays zero earnings when the pay period is entirely outside the employee's actual employment window", async () => {
    const employeeId = oid();
    SalaryStructure.findOne.mockResolvedValue({ components: [{ name: "Basic", type: "earning", amount: 31000 }] });
    // Left well before this payslip's month even started.
    User.findById.mockReturnValue(makeUserQuery({ _id: employeeId, name: "Eve", email: "eve@example.com" }));
    Offboarding.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ lastWorkingDate: new Date("2026-07-01") }) });
    Payslip.create.mockResolvedValue(fullPayslip());

    const req = { body: { employeeId: employeeId.toString(), month: 8, year: 2026 }, user: hrUser() };
    await generatePayslip(req, mockRes());
    await flushMicrotasks();

    expect(Payslip.create).toHaveBeenCalledWith(
      expect.objectContaining({ actualPayableDays: 0, daysPayable: 0, grossEarnings: 0, netPay: 0 }),
    );
  });

  it("does not prorate contributions or deductions — only earnings scale with payable days", async () => {
    const employeeId = oid();
    SalaryStructure.findOne.mockResolvedValue({
      components: [
        { name: "Basic", type: "earning", amount: 31000 },
        { name: "PF Employer", type: "contribution", amount: 1800 },
        { name: "Professional Tax", type: "deduction", amount: 200 },
      ],
    });
    User.findById.mockReturnValue(makeUserQuery({ _id: employeeId, name: "Eve", email: "eve@example.com", joiningDate: new Date("2026-08-15") }));
    Payslip.create.mockResolvedValue(fullPayslip());

    const req = { body: { employeeId: employeeId.toString(), month: 8, year: 2026 }, user: hrUser() };
    await generatePayslip(req, mockRes());
    await flushMicrotasks();

    expect(Payslip.create).toHaveBeenCalledWith(
      expect.objectContaining({ grossEarnings: 17000, totalContributions: 1800, totalDeductions: 200, netPay: 15000 }),
    );
  });

  it("409s a duplicate period", async () => {
    SalaryStructure.findOne.mockResolvedValue({ components: [{ name: "Basic", type: "earning", amount: 1000 }] });
    User.findById.mockReturnValue(makeUserQuery({ _id: oid(), name: "Eve", email: "eve@example.com" }));
    const error = new Error("dup");
    error.code = 11000;
    Payslip.create.mockRejectedValue(error);

    const req = { body: { employeeId: oid().toString(), month: 8, year: 2026 }, user: hrUser() };
    const res = mockRes();

    await generatePayslip(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe("generateBulkPayslips", () => {
  it("400s an invalid period", async () => {
    const req = { body: { month: 0, year: 2026 }, user: hrUser() };
    const res = mockRes();

    await generateBulkPayslips(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(SalaryStructure.find).not.toHaveBeenCalled();
  });

  it("skips terminated/archived employees and generates for the rest", async () => {
    const active = { _id: oid(), name: "Active Eve", email: "eve@example.com", employmentStatus: "active", archived: { hrms: false } };
    const terminated = { _id: oid(), name: "Gone Gary", email: "gary@example.com", employmentStatus: "terminated", archived: { hrms: false } };
    const archived = { _id: oid(), name: "Archived Amy", email: "amy@example.com", employmentStatus: "active", archived: { hrms: true } };

    SalaryStructure.find.mockReturnValue({
      populate: vi.fn().mockResolvedValue([
        { employee: active, components: [{ name: "Basic", type: "earning", amount: 1000 }] },
        { employee: terminated, components: [{ name: "Basic", type: "earning", amount: 1000 }] },
        { employee: archived, components: [{ name: "Basic", type: "earning", amount: 1000 }] },
      ]),
    });
    Payslip.create.mockResolvedValue(fullPayslip());

    const req = { body: { month: 8, year: 2026 }, user: hrUser() };
    const res = mockRes();

    await generateBulkPayslips(req, res);
    await flushMicrotasks();

    expect(Payslip.create).toHaveBeenCalledTimes(1);
    expect(Payslip.create).toHaveBeenCalledWith(expect.objectContaining({ employee: active._id }));
    expect(res.json).toHaveBeenCalledWith({ generated: 1, skipped: 2, total: 3 });
  });

  it("skips (not errors) an employee who already has a payslip for the period", async () => {
    const employee = { _id: oid(), name: "Eve", email: "eve@example.com", employmentStatus: "active", archived: { hrms: false } };
    SalaryStructure.find.mockReturnValue({
      populate: vi.fn().mockResolvedValue([{ employee, components: [{ name: "Basic", type: "earning", amount: 1000 }] }]),
    });
    const error = new Error("dup");
    error.code = 11000;
    Payslip.create.mockRejectedValue(error);

    const req = { body: { month: 8, year: 2026 }, user: hrUser() };
    const res = mockRes();

    await generateBulkPayslips(req, res);

    expect(res.json).toHaveBeenCalledWith({ generated: 0, skipped: 1, total: 1 });
  });
});

describe("listMyPayslips", () => {
  it("scopes to the caller", async () => {
    const employee = { _id: oid(), roles: { hrms: "employee" } };
    const sort = vi.fn().mockResolvedValue([]);
    Payslip.find.mockReturnValue({ sort });

    await listMyPayslips({ user: employee }, mockRes());

    expect(Payslip.find).toHaveBeenCalledWith({ employee: employee._id });
  });
});

describe("listPayslips", () => {
  it("filters by employee/month/year when given", async () => {
    const populate = vi.fn().mockReturnValue({ sort: vi.fn().mockResolvedValue([]) });
    Payslip.find.mockReturnValue({ populate });
    const employeeId = oid().toString();

    await listPayslips({ query: { employee: employeeId, month: "8", year: "2026" }, user: hrUser() }, mockRes());

    expect(Payslip.find).toHaveBeenCalledWith({ employee: employeeId, month: 8, year: 2026 });
  });
});

describe("markPayslipPaid", () => {
  it("404s when not found", async () => {
    Payslip.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(null) });
    const req = { params: { id: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await markPayslipPaid(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("409s an already-paid payslip", async () => {
    Payslip.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue({ _id: oid(), status: "paid" }) });
    const req = { params: { id: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await markPayslipPaid(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("marks a generated payslip paid and emails the employee", async () => {
    const employeeId = oid();
    const payslip = {
      _id: oid(), status: "generated", month: 8, year: 2026,
      employee: { _id: employeeId, name: "Eve", email: "eve@example.com" },
      save: vi.fn().mockResolvedValue(undefined),
    };
    Payslip.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(payslip) });

    const req = { params: { id: payslip._id.toString() }, user: hrUser() };
    await markPayslipPaid(req, mockRes());

    expect(payslip.status).toBe("paid");
    expect(payslip.paidAt).toBeInstanceOf(Date);
    expect(notifyUsers).toHaveBeenCalledWith([employeeId], expect.objectContaining({ type: "payslipPaid" }));
    expect(sendHrmsEmail).toHaveBeenCalledWith("eve@example.com", expect.any(String), expect.any(String), expect.any(String));
  });
});

describe("getPayslipPdf", () => {
  it("404s when not found", async () => {
    Payslip.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(null) });
    const req = { params: { id: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await getPayslipPdf(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403s an employee requesting someone else's payslip", async () => {
    const payslip = { _id: oid(), employee: { _id: oid(), name: "Eve", email: "e@example.com" } };
    Payslip.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(payslip) });

    const req = { params: { id: oid().toString() }, user: { _id: oid(), roles: { hrms: "employee" } } };
    const res = mockRes();

    await getPayslipPdf(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("streams a PDF for the owning employee", async () => {
    const employee = { _id: oid(), name: "Eve", email: "e@example.com" };
    const payslip = {
      _id: oid(), month: 8, year: 2026, status: "generated", employee,
      components: [
        { name: "Basic", type: "earning", amount: 1000 },
        { name: "PF Employee", type: "contribution", amount: 100 },
        { name: "Professional Tax", type: "deduction", amount: 50 },
      ],
      grossEarnings: 1000, totalContributions: 100, totalDeductions: 50, netPay: 850,
      employeeNumber: "EMP1001", department: "Engineering", designation: "Developer", location: "Hyderabad",
      paymentMode: "bank_transfer", uan: "101655166440", panNumber: "ABCDE1234F", dateOfBirth: new Date("1999-08-02"),
      monthlySalary: 60000, totalWorkingDays: 31, lossOfPayDays: 0, actualPayableDays: 31, daysPayable: 31,
    };
    Payslip.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(payslip) });

    const req = { params: { id: payslip._id.toString() }, user: { _id: employee._id, roles: { hrms: "employee" } } };
    const res = { ...mockRes(), pipe: undefined };

    await getPayslipPdf(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.status).not.toHaveBeenCalledWith(404);
  });
});
