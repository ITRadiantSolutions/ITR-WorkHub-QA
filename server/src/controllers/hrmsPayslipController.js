import PDFDocument from "pdfkit";
import Payslip from "../models/Payslip.js";
import SalaryStructure from "../models/SalaryStructure.js";
import User from "../models/User.js";
import { writeAuditLog } from "../utils/activityLog.js";
import { notifyUsers } from "../utils/notify.js";
import { sendHrmsEmail } from "../utils/hrmsMailer.js";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const computeTotals = (components) => {
  const grossEarnings = components.filter((c) => c.type === "earning").reduce((sum, c) => sum + c.amount, 0);
  const totalDeductions = components.filter((c) => c.type === "deduction").reduce((sum, c) => sum + c.amount, 0);
  return { grossEarnings, totalDeductions, netPay: grossEarnings - totalDeductions };
};

const notifyPayslipGenerated = (employee, month, year) => {
  notifyUsers([employee._id], {
    title: "Payslip generated",
    message: `Your payslip for ${MONTH_NAMES[month - 1]} ${year} is ready.`,
    type: "payslipGenerated",
    activityType: "create",
    performedBy: employee._id,
  });
  sendHrmsEmail(
    employee.email, `Your payslip for ${MONTH_NAMES[month - 1]} ${year} is ready`, "Payslip generated",
    `<p>Hi ${employee.name}, your payslip for <strong>${MONTH_NAMES[month - 1]} ${year}</strong> has been generated and is available in the Payroll section.</p>`,
  );
};

export const generatePayslip = async (req, res) => {
  const { employeeId, month, year } = req.body;
  const m = Number(month);
  const y = Number(year);
  if (!employeeId || !Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y)) {
    return res.status(400).json({ message: "employeeId, a valid month (1-12) and year are required" });
  }

  const [structure, employee] = await Promise.all([
    SalaryStructure.findOne({ employee: employeeId }),
    User.findById(employeeId).select("name email"),
  ]);
  if (!structure) return res.status(404).json({ message: "This employee has no salary structure set up yet" });
  if (!employee) return res.status(404).json({ message: "Employee not found" });

  const { grossEarnings, totalDeductions, netPay } = computeTotals(structure.components);

  let payslip;
  try {
    payslip = await Payslip.create({
      employee: employeeId,
      month: m,
      year: y,
      components: structure.components,
      grossEarnings,
      totalDeductions,
      netPay,
      generatedBy: req.user._id,
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A payslip for this employee and period already exists" });
    throw error;
  }

  writeAuditLog({
    type: "database", event: "hrms.payslip.generated", action: "hrms.payslip.generated",
    actorId: req.user._id, targetId: payslip._id, oldValue: null, newValue: { month: m, year: y, netPay },
  });
  notifyPayslipGenerated(employee, m, y);

  res.status(201).json(payslip);
};

// Generates a payslip for every employee with a salary structure who doesn't
// already have one for this period — skips (doesn't error on) employees with
// no structure yet, terminated/archived employees, or an existing payslip.
export const generateBulkPayslips = async (req, res) => {
  const { month, year } = req.body;
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y)) {
    return res.status(400).json({ message: "A valid month (1-12) and year are required" });
  }

  const structures = await SalaryStructure.find({}).populate("employee", "name email employmentStatus archived");

  let generated = 0;
  let skipped = 0;
  for (const structure of structures) {
    const employee = structure.employee;
    if (!employee || employee.employmentStatus === "terminated" || employee.archived?.hrms) {
      skipped += 1;
      continue;
    }
    const { grossEarnings, totalDeductions, netPay } = computeTotals(structure.components);
    try {
      const payslip = await Payslip.create({
        employee: employee._id, month: m, year: y, components: structure.components,
        grossEarnings, totalDeductions, netPay, generatedBy: req.user._id,
      });
      generated += 1;
      writeAuditLog({
        type: "database", event: "hrms.payslip.generated", action: "hrms.payslip.generated",
        actorId: req.user._id, targetId: payslip._id, oldValue: null, newValue: { month: m, year: y, netPay, bulk: true },
      });
      notifyPayslipGenerated(employee, m, y);
    } catch (error) {
      if (error.code === 11000) { skipped += 1; continue; }
      throw error;
    }
  }

  res.json({ generated, skipped, total: structures.length });
};

export const listMyPayslips = async (req, res) => {
  const payslips = await Payslip.find({ employee: req.user._id }).sort({ year: -1, month: -1 });
  res.json(payslips);
};

export const listPayslips = async (req, res) => {
  const filter = {};
  if (req.query.employee?.trim()) filter.employee = req.query.employee.trim();
  if (req.query.month) filter.month = Number(req.query.month);
  if (req.query.year) filter.year = Number(req.query.year);
  const payslips = await Payslip.find(filter).populate("employee", "name email").sort({ year: -1, month: -1 });
  res.json(payslips);
};

export const markPayslipPaid = async (req, res) => {
  const payslip = await Payslip.findById(req.params.id).populate("employee", "name email");
  if (!payslip) return res.status(404).json({ message: "Payslip not found" });
  if (payslip.status === "paid") return res.status(409).json({ message: "This payslip is already marked paid" });

  payslip.status = "paid";
  payslip.paidAt = new Date();
  await payslip.save();

  writeAuditLog({
    type: "database", event: "hrms.payslip.paid", action: "hrms.payslip.paid",
    actorId: req.user._id, targetId: payslip._id, oldValue: { status: "generated" }, newValue: { status: "paid" },
  });
  notifyUsers([payslip.employee._id], {
    title: "Payslip marked paid",
    message: `Your payslip for ${MONTH_NAMES[payslip.month - 1]} ${payslip.year} has been marked as paid.`,
    type: "payslipPaid",
    activityType: "status_change",
    performedBy: req.user._id,
  });
  sendHrmsEmail(
    payslip.employee.email, `Your ${MONTH_NAMES[payslip.month - 1]} ${payslip.year} payslip has been paid`, "Payslip paid",
    `<p>Hi ${payslip.employee.name}, your payslip for <strong>${MONTH_NAMES[payslip.month - 1]} ${payslip.year}</strong> has been marked as paid.</p>`,
  );

  res.json(payslip);
};

export const getPayslipPdf = async (req, res) => {
  const payslip = await Payslip.findById(req.params.id).populate("employee", "name email");
  if (!payslip) return res.status(404).json({ message: "Payslip not found" });
  if (req.user.roles.hrms !== "hr" && payslip.employee._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const period = `${MONTH_NAMES[payslip.month - 1]}-${payslip.year}`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="payslip-${period}.pdf"`);

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  doc.pipe(res);

  doc.fontSize(18).font("Helvetica-Bold").text("Payslip", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(11).font("Helvetica").fillColor("#555").text(`${MONTH_NAMES[payslip.month - 1]} ${payslip.year}`, { align: "center" });
  doc.moveDown(1.5);

  doc.fillColor("#111").fontSize(11);
  doc.text(`Employee: ${payslip.employee.name}`);
  doc.text(`Email: ${payslip.employee.email}`);
  doc.moveDown(1);

  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").stroke();
  doc.moveDown(0.5);

  payslip.components.forEach((c) => {
    const y = doc.y;
    doc.text(c.name, 50, y, { width: 350 });
    doc.text(`${c.type === "deduction" ? "-" : ""}${c.amount.toFixed(2)}`, 400, y, { width: 145, align: "right" });
    doc.moveDown(0.4);
  });

  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").stroke();
  doc.moveDown(0.5);

  const summaryRow = (label, value, bold) => {
    const y = doc.y;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 13 : 11);
    doc.text(label, 50, y, { width: 350 });
    doc.text(value, 400, y, { width: 145, align: "right" });
    doc.moveDown(0.4);
  };
  summaryRow("Gross earnings", payslip.grossEarnings.toFixed(2));
  summaryRow("Total deductions", `-${payslip.totalDeductions.toFixed(2)}`);
  summaryRow("Net pay", payslip.netPay.toFixed(2), true);

  doc.moveDown(1.5);
  doc.font("Helvetica").fontSize(9).fillColor("#888").text(`Status: ${payslip.status}${payslip.paidAt ? ` on ${new Date(payslip.paidAt).toDateString()}` : ""}`);

  doc.end();
};
