import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Expense.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findById: vi.fn() },
  EXPENSE_CATEGORIES: ["travel", "food", "accommodation", "office_supplies", "internet", "other"],
}));
vi.mock("../models/User.js", () => ({ default: { find: vi.fn() } }));
vi.mock("../config/blobStorage.js", () => ({ uploadAttachment: vi.fn(), createReadUrl: vi.fn(() => "https://signed.example/bill") }));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("../utils/notify.js", () => ({ notifyUsers: vi.fn() }));
vi.mock("../utils/hrmsMailer.js", () => ({ sendHrmsEmail: vi.fn() }));

import Expense from "../models/Expense.js";
import User from "../models/User.js";
import { notifyUsers } from "../utils/notify.js";
import { sendHrmsEmail } from "../utils/hrmsMailer.js";
import {
  createExpense,
  listMyExpenses,
  listTeamExpenses,
  listExpenses,
  reviewExpense,
  markExpenseReimbursed,
  getBillUrl,
} from "./hrmsExpenseController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const makeQuery = (result) => {
  const query = {};
  query.populate = vi.fn().mockReturnValue(query);
  query.sort = vi.fn().mockResolvedValue(result);
  query.then = (resolve) => resolve(result);
  return query;
};

const employeeUser = (managerId = null) => ({ _id: oid(), name: "Eve Employee", managerId, roles: { hrms: "employee" } });
const managerUser = () => ({ _id: oid(), name: "Mo Manager", roles: { hrms: "manager" } });
const hrUser = () => ({ _id: oid(), name: "Helen HR", roles: { hrms: "hr" } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createExpense", () => {
  it("400s an invalid category", async () => {
    const req = { body: { category: "yacht", amount: 100, expenseDate: "2026-08-01" }, user: employeeUser(), file: null };
    const res = mockRes();

    await createExpense(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Expense.create).not.toHaveBeenCalled();
  });

  it("400s a non-positive amount", async () => {
    const req = { body: { category: "travel", amount: 0, expenseDate: "2026-08-01" }, user: employeeUser(), file: null };
    const res = mockRes();

    await createExpense(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("creates an expense, notifies the manager, and emails them", async () => {
    const manager = managerUser();
    const employee = employeeUser(manager._id);
    const created = { _id: oid() };
    Expense.create.mockResolvedValue(created);
    Expense.findById.mockReturnValue(makeQuery({ _id: created._id, status: "submitted" }));
    User.find.mockReturnValue({ select: vi.fn().mockResolvedValue([{ email: "mo@example.com" }]) });

    const req = { body: { category: "travel", amount: 500, expenseDate: "2026-08-01" }, user: employee, file: null };
    const res = mockRes();

    await createExpense(req, res);

    expect(Expense.create).toHaveBeenCalledWith(expect.objectContaining({ employee: employee._id, amount: 500 }));
    expect(notifyUsers).toHaveBeenCalledWith([manager._id], expect.objectContaining({ type: "expenseSubmitted" }));
    expect(sendHrmsEmail).toHaveBeenCalledWith("mo@example.com", expect.any(String), expect.any(String), expect.any(String));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("falls back to notifying HR when the employee has no manager", async () => {
    Expense.create.mockResolvedValue({ _id: oid() });
    Expense.findById.mockReturnValue(makeQuery({}));
    const hrIds = [oid()];
    User.find.mockReturnValue({ select: vi.fn().mockResolvedValue(hrIds.map((id) => ({ _id: id }))) });

    const req = { body: { category: "travel", amount: 500, expenseDate: "2026-08-01" }, user: employeeUser(null), file: null };
    await createExpense(req, mockRes());

    expect(notifyUsers).toHaveBeenCalledWith(hrIds, expect.objectContaining({ type: "expenseSubmitted" }));
  });
});

describe("listMyExpenses", () => {
  it("scopes to the caller", async () => {
    const employee = employeeUser();
    Expense.find.mockReturnValue(makeQuery([]));

    await listMyExpenses({ query: {}, user: employee }, mockRes());

    expect(Expense.find).toHaveBeenCalledWith({ employee: employee._id });
  });
});

describe("listTeamExpenses", () => {
  it("scopes to the manager's direct reports", async () => {
    const manager = managerUser();
    const reportId = oid();
    User.find.mockReturnValue({ select: vi.fn().mockResolvedValue([{ _id: reportId }]) });
    Expense.find.mockReturnValue(makeQuery([]));

    await listTeamExpenses({ query: {}, user: manager }, mockRes());

    expect(Expense.find).toHaveBeenCalledWith({ employee: { $in: [reportId] } });
  });
});

describe("listExpenses", () => {
  it("403s a non-HR caller", async () => {
    const req = { query: {}, user: managerUser() };
    const res = mockRes();

    await listExpenses(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Expense.find).not.toHaveBeenCalled();
  });
});

describe("reviewExpense", () => {
  it("403s a manager who isn't the employee's manager", async () => {
    const expenseDoc = { _id: oid(), status: "submitted", employee: { _id: oid(), managerId: oid() } };
    Expense.findById.mockReturnValue(makeQuery(expenseDoc));

    const req = { params: { id: expenseDoc._id.toString() }, body: { action: "approve" }, user: managerUser() };
    const res = mockRes();

    await reviewExpense(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("409s reviewing an already-decided expense", async () => {
    const expenseDoc = { _id: oid(), status: "approved", employee: { _id: oid(), managerId: oid() } };
    Expense.findById.mockReturnValue(makeQuery(expenseDoc));

    const req = { params: { id: expenseDoc._id.toString() }, body: { action: "approve" }, user: hrUser() };
    const res = mockRes();

    await reviewExpense(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("HR approves a submitted expense, notifies, and emails the employee", async () => {
    const employeeId = oid();
    const expenseDoc = {
      _id: oid(), status: "submitted", employee: { _id: employeeId, email: "eve@example.com", managerId: oid() }, category: "travel",
      save: vi.fn().mockResolvedValue(undefined),
    };
    Expense.findById.mockReturnValue(makeQuery(expenseDoc));

    const hr = hrUser();
    const req = { params: { id: expenseDoc._id.toString() }, body: { action: "approve" }, user: hr };
    await reviewExpense(req, mockRes());

    expect(expenseDoc.status).toBe("approved");
    expect(notifyUsers).toHaveBeenCalledWith([employeeId], expect.objectContaining({ type: "expenseApproved" }));
    expect(sendHrmsEmail).toHaveBeenCalledWith("eve@example.com", expect.any(String), expect.any(String), expect.any(String));
  });
});

describe("markExpenseReimbursed", () => {
  it("409s a non-approved expense", async () => {
    Expense.findById.mockReturnValue(makeQuery({ _id: oid(), status: "submitted" }));
    const req = { params: { id: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await markExpenseReimbursed(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("marks an approved expense reimbursed, notifies, and emails the employee", async () => {
    const employeeId = oid();
    const expenseDoc = {
      _id: oid(), status: "approved", employee: { _id: employeeId, email: "eve@example.com" }, category: "travel",
      save: vi.fn().mockResolvedValue(undefined),
    };
    Expense.findById.mockReturnValue(makeQuery(expenseDoc));

    const req = { params: { id: expenseDoc._id.toString() }, user: hrUser() };
    await markExpenseReimbursed(req, mockRes());

    expect(expenseDoc.status).toBe("reimbursed");
    expect(notifyUsers).toHaveBeenCalledWith([employeeId], expect.objectContaining({ type: "expenseReimbursed" }));
    expect(sendHrmsEmail).toHaveBeenCalledWith("eve@example.com", expect.any(String), expect.any(String), expect.any(String));
  });
});

describe("getBillUrl", () => {
  it("403s someone who isn't the owner or HR", async () => {
    const ownerId = oid();
    Expense.findById.mockResolvedValue({ _id: oid(), employee: ownerId, billBlobName: "blob" });
    const req = { params: { id: oid().toString() }, user: employeeUser() };
    const res = mockRes();

    await getBillUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("404s when there's no bill", async () => {
    const employee = employeeUser();
    Expense.findById.mockResolvedValue({ _id: oid(), employee: employee._id, billBlobName: "" });
    const req = { params: { id: oid().toString() }, user: employee };
    const res = mockRes();

    await getBillUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns a signed url for the owner", async () => {
    const employee = employeeUser();
    Expense.findById.mockResolvedValue({ _id: oid(), employee: employee._id, billBlobName: "blob-name" });
    const req = { params: { id: oid().toString() }, user: employee };
    const res = mockRes();

    await getBillUrl(req, res);

    expect(res.json).toHaveBeenCalledWith({ url: "https://signed.example/bill" });
  });
});
