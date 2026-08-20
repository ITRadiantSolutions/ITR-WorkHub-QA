import Expense, { EXPENSE_CATEGORIES } from "../models/Expense.js";
import User from "../models/User.js";
import { uploadAttachment, createReadUrl } from "../config/blobStorage.js";
import { writeAuditLog } from "../utils/activityLog.js";
import { notifyUsers } from "../utils/notify.js";

const ALLOWED_BILL_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"];

const populateExpense = (query) =>
  query.populate("employee", "name email managerId").populate("decidedBy", "name email");

const hrUserIds = async () => (await User.find({ "roles.hrms": "hr" }).select("_id")).map((u) => u._id);

export const createExpense = async (req, res) => {
  const { category, amount, expenseDate, description } = req.body;
  if (!EXPENSE_CATEGORIES.includes(category)) {
    return res.status(400).json({ message: `category must be one of: ${EXPENSE_CATEGORIES.join(", ")}` });
  }
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) return res.status(400).json({ message: "amount must be a positive number" });
  if (!expenseDate) return res.status(400).json({ message: "expenseDate is required" });
  if (req.file && !ALLOWED_BILL_MIME_TYPES.includes(req.file.mimetype)) {
    return res.status(400).json({ message: `Unsupported file type: ${req.file.mimetype}. Only PDF, PNG and JPEG are allowed.` });
  }

  const expense = await Expense.create({
    employee: req.user._id,
    category,
    amount: amountNum,
    expenseDate,
    description: description?.trim() || "",
  });

  if (req.file) {
    const uploaded = await uploadAttachment({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      scope: "hrms-expense-bill",
      parentId: expense._id.toString(),
    });
    expense.billBlobName = uploaded.blobName;
    expense.billFileName = req.file.originalname;
    await expense.save();
  }

  writeAuditLog({
    type: "database", event: "hrms.expense.created", action: "hrms.expense.created",
    actorId: req.user._id, targetId: expense._id, oldValue: null, newValue: { status: "submitted", amount: amountNum },
  });

  const approverIds = req.user.managerId ? [req.user.managerId] : await hrUserIds();
  notifyUsers(approverIds, {
    title: "New expense claim",
    message: `${req.user.name} submitted a ${category.replace(/_/g, " ")} expense of ${amountNum}.`,
    type: "expenseSubmitted",
    activityType: "create",
    performedBy: req.user._id,
  });

  res.status(201).json(await populateExpense(Expense.findById(expense._id)));
};

export const listMyExpenses = async (req, res) => {
  const filter = { employee: req.user._id };
  if (req.query.status?.trim()) filter.status = req.query.status.trim();
  const expenses = await populateExpense(Expense.find(filter)).sort({ createdAt: -1 });
  res.json(expenses);
};

export const listTeamExpenses = async (req, res) => {
  const reports = await User.find({ managerId: req.user._id }).select("_id");
  const filter = { employee: { $in: reports.map((r) => r._id) } };
  if (req.query.status?.trim()) filter.status = req.query.status.trim();
  const expenses = await populateExpense(Expense.find(filter)).sort({ createdAt: -1 });
  res.json(expenses);
};

export const listExpenses = async (req, res) => {
  if (req.user.roles.hrms !== "hr") return res.status(403).json({ message: "Forbidden" });
  const filter = {};
  if (req.query.status?.trim()) filter.status = req.query.status.trim();
  if (req.query.employee?.trim()) filter.employee = req.query.employee.trim();
  const expenses = await populateExpense(Expense.find(filter)).sort({ createdAt: -1 });
  res.json(expenses);
};

const canDecide = (expense, user) => {
  if (user.roles.hrms === "hr") return true;
  return user.roles.hrms === "manager" && expense.employee.managerId?.toString() === user._id.toString();
};

export const reviewExpense = async (req, res) => {
  const { action, comment } = req.body;
  if (!["approve", "reject"].includes(action)) {
    return res.status(400).json({ message: "action must be 'approve' or 'reject'" });
  }

  const expense = await populateExpense(Expense.findById(req.params.id));
  if (!expense) return res.status(404).json({ message: "Expense not found" });
  if (!canDecide(expense, req.user)) return res.status(403).json({ message: "Forbidden" });
  if (expense.status !== "submitted") {
    return res.status(409).json({ message: `Cannot review an expense with status '${expense.status}'` });
  }

  const oldStatus = expense.status;
  expense.status = action === "approve" ? "approved" : "rejected";
  expense.decidedBy = req.user._id;
  expense.decidedAt = new Date();
  expense.decisionComment = comment?.trim() || "";
  await expense.save();

  writeAuditLog({
    type: "database", event: `hrms.expense.${expense.status}`, action: `hrms.expense.${expense.status}`,
    actorId: req.user._id, targetId: expense._id, oldValue: { status: oldStatus }, newValue: { status: expense.status },
  });
  notifyUsers([expense.employee._id], {
    title: `Expense ${expense.status}`,
    message: `Your ${expense.category.replace(/_/g, " ")} expense claim was ${expense.status}.`,
    type: expense.status === "approved" ? "expenseApproved" : "expenseRejected",
    activityType: "status_change",
    performedBy: req.user._id,
  });

  res.json(expense);
};

export const markExpenseReimbursed = async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) return res.status(404).json({ message: "Expense not found" });
  if (expense.status !== "approved") {
    return res.status(409).json({ message: "Only an approved expense can be marked reimbursed" });
  }

  expense.status = "reimbursed";
  expense.reimbursedAt = new Date();
  await expense.save();

  writeAuditLog({
    type: "database", event: "hrms.expense.reimbursed", action: "hrms.expense.reimbursed",
    actorId: req.user._id, targetId: expense._id, oldValue: { status: "approved" }, newValue: { status: "reimbursed" },
  });
  notifyUsers([expense.employee], {
    title: "Expense reimbursed",
    message: `Your ${expense.category.replace(/_/g, " ")} expense claim has been reimbursed.`,
    type: "expenseReimbursed",
    activityType: "status_change",
    performedBy: req.user._id,
  });

  res.json(expense);
};

const canAccessBill = (expense, user) =>
  user.roles.hrms === "hr" || expense.employee.toString() === user._id.toString();

export const getBillUrl = async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) return res.status(404).json({ message: "Expense not found" });
  if (!canAccessBill(expense, req.user)) return res.status(403).json({ message: "Forbidden" });
  if (!expense.billBlobName) return res.status(404).json({ message: "No bill uploaded" });

  res.json({ url: createReadUrl(expense.billBlobName) });
};
