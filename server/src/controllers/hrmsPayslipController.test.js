import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Payslip.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findById: vi.fn() },
}));
vi.mock("../models/SalaryStructure.js", () => ({
  default: { findOne: vi.fn(), find: vi.fn() },
}));
vi.mock("../models/User.js", () => ({ default: { findById: vi.fn() } }));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("../utils/notify.js", () => ({ notifyUsers: vi.fn() }));
vi.mock("../utils/hrmsMailer.js", () => ({ sendHrmsEmail: vi.fn() }));
vi.mock("pdfkit", () => {
  class FakePDFDocument {
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
    end() { return this; }
    get y() { return 100; }
  }
  return { default: FakePDFDocument };
});

import Payslip from "../models/Payslip.js";
import SalaryStructure from "../models/SalaryStructure.js";
import User from "../models/User.js";
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

beforeEach(() => {
  vi.clearAllMocks();
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
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: oid(), name: "Eve", email: "eve@example.com" }) });
    const req = { body: { employeeId: oid().toString(), month: 8, year: 2026 }, user: hrUser() };
    const res = mockRes();

    await generatePayslip(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("computes gross/deductions/net and notifies + emails the employee", async () => {
    const employeeId = oid();
    SalaryStructure.findOne.mockResolvedValue({
      components: [
        { name: "Basic", type: "earning", amount: 50000 },
        { name: "HRA", type: "earning", amount: 10000 },
        { name: "PF", type: "deduction", amount: 1800 },
      ],
    });
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: employeeId, name: "Eve", email: "eve@example.com" }) });
    Payslip.create.mockResolvedValue({ _id: oid() });

    const req = { body: { employeeId: employeeId.toString(), month: 8, year: 2026 }, user: hrUser() };
    const res = mockRes();

    await generatePayslip(req, res);

    expect(Payslip.create).toHaveBeenCalledWith(
      expect.objectContaining({ grossEarnings: 60000, totalDeductions: 1800, netPay: 58200 }),
    );
    expect(notifyUsers).toHaveBeenCalledWith([employeeId], expect.objectContaining({ type: "payslipGenerated" }));
    expect(sendHrmsEmail).toHaveBeenCalledWith("eve@example.com", expect.any(String), expect.any(String), expect.any(String));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("409s a duplicate period", async () => {
    SalaryStructure.findOne.mockResolvedValue({ components: [{ name: "Basic", type: "earning", amount: 1000 }] });
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: oid(), name: "Eve", email: "eve@example.com" }) });
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
    Payslip.create.mockResolvedValue({ _id: oid() });

    const req = { body: { month: 8, year: 2026 }, user: hrUser() };
    const res = mockRes();

    await generateBulkPayslips(req, res);

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
      components: [{ name: "Basic", type: "earning", amount: 1000 }],
      grossEarnings: 1000, totalDeductions: 0, netPay: 1000,
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
