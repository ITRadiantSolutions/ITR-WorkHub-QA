import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import Payslip from "../models/Payslip.js";
import SalaryStructure from "../models/SalaryStructure.js";
import User from "../models/User.js";
import LeaveRequest from "../models/LeaveRequest.js";
import { writeAuditLog } from "../utils/activityLog.js";
import { notifyUsers } from "../utils/notify.js";
import { sendHrmsEmail } from "../utils/hrmsMailer.js";
import { numberToIndianWords } from "../utils/numberToWords.js";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const LOGO_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "itr-logo.png");

const COMPANY = {
  name: "ITRADIANT SOLUTIONS PVT LTD",
  // Matches the source template's own address field layout exactly (street
  // address, then city, then city/state/PIN as separate lines).
  addressLines: [
    "SUITE NO 506,JAIN SADGURU IMAGE'S CAPITAL PARK,IMAGE GARDEN",
    "ROAD,MADHAPUR,HITECH CITY,HYDERABAD",
    "HYDERABAD",
    "HYDERABAD TELANGANA 500081",
  ],
};

const PAYMENT_MODE_LABELS = { bank_transfer: "Bank Transfer", cash: "Cash", cheque: "Cheque" };

const computeTotals = (components) => {
  const sum = (type) => components.filter((c) => c.type === type).reduce((s, c) => s + c.amount, 0);
  const grossEarnings = sum("earning");
  const totalContributions = sum("contribution");
  const totalDeductions = sum("deduction");
  return { grossEarnings, totalContributions, totalDeductions, netPay: grossEarnings - totalContributions - totalDeductions };
};

// LOP is attributed to the month a leave request started in — a simplification
// (a request spanning a month boundary counts its LOP days entirely in its
// start month) rather than splitting lopDays proportionally across months.
const computeLopDays = async (employeeId, month, year) => {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const requests = await LeaveRequest.find({
    employee: employeeId,
    status: "approved",
    startDate: { $gte: monthStart, $lte: monthEnd },
  }).select("lopDays");
  return requests.reduce((sum, r) => sum + (r.lopDays || 0), 0);
};

const populateEmployeeForPayslip = (id) => User.findById(id).select("name email employeeId department designation dateOfBirth panNumber locationId").populate("locationId", "name");

// Builds the snapshot fields stored on a Payslip at generation time — see
// the model comment on why these are copied rather than referenced live.
const buildSnapshot = async (employee, structure, month, year) => {
  const totalWorkingDays = new Date(year, month, 0).getDate(); // calendar days in the pay cycle
  const lossOfPayDays = await computeLopDays(employee._id, month, year);
  const actualPayableDays = Math.max(0, totalWorkingDays - lossOfPayDays);

  return {
    employeeNumber: employee.employeeId || "",
    department: employee.department || "",
    designation: employee.designation || "",
    location: employee.locationId?.name || "",
    paymentMode: structure.paymentMode || "bank_transfer",
    uan: structure.uan || "",
    panNumber: employee.panNumber || "",
    dateOfBirth: employee.dateOfBirth || null,
    monthlySalary: structure.monthlySalary || 0,
    totalWorkingDays,
    lossOfPayDays,
    actualPayableDays,
    daysPayable: actualPayableDays,
  };
};

// Renders the payslip PDF (best-effort — a rendering failure still leaves
// the in-app notification and a plain-text email fallback intact) and
// attaches it, rather than just linking back to the app.
const notifyPayslipGenerated = (payslip, employee) => {
  const { month, year } = payslip;
  notifyUsers([employee._id], {
    title: "Payslip generated",
    message: `Your payslip for ${MONTH_NAMES[month - 1]} ${year} is ready.`,
    type: "payslipGenerated",
    activityType: "create",
    performedBy: employee._id,
  });

  const subject = `Your payslip for ${MONTH_NAMES[month - 1]} ${year} is ready`;
  const title = "Payslip generated";
  const body = `<p>Hi ${employee.name}, your payslip for <strong>${MONTH_NAMES[month - 1]} ${year}</strong> has been generated — attached as a PDF, and also available in the Payroll section.</p>`;

  renderPayslipPdfBuffer({ ...(payslip.toObject ? payslip.toObject() : payslip), employee })
    .then((buffer) => sendHrmsEmail(employee.email, subject, title, body, [
      { filename: `payslip-${MONTH_NAMES[month - 1]}-${year}.pdf`, content: buffer, contentType: "application/pdf" },
    ]))
    .catch((error) => {
      console.error("Failed to render payslip PDF for email, sending without attachment:", error.message);
      sendHrmsEmail(employee.email, subject, title, body);
    });
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
    populateEmployeeForPayslip(employeeId),
  ]);
  if (!structure) return res.status(404).json({ message: "This employee has no salary structure set up yet" });
  if (!employee) return res.status(404).json({ message: "Employee not found" });

  const { grossEarnings, totalContributions, totalDeductions, netPay } = computeTotals(structure.components);
  const snapshot = await buildSnapshot(employee, structure, m, y);

  let payslip;
  try {
    payslip = await Payslip.create({
      employee: employeeId,
      month: m,
      year: y,
      components: structure.components,
      grossEarnings,
      totalContributions,
      totalDeductions,
      netPay,
      generatedBy: req.user._id,
      ...snapshot,
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A payslip for this employee and period already exists" });
    throw error;
  }

  writeAuditLog({
    type: "database", event: "hrms.payslip.generated", action: "hrms.payslip.generated",
    actorId: req.user._id, targetId: payslip._id, oldValue: null, newValue: { month: m, year: y, netPay },
  });
  notifyPayslipGenerated(payslip, employee);

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

  const structures = await SalaryStructure.find({}).populate({
    path: "employee",
    select: "name email employmentStatus archived employeeId department designation dateOfBirth panNumber locationId",
    populate: { path: "locationId", select: "name" },
  });

  let generated = 0;
  let skipped = 0;
  for (const structure of structures) {
    const employee = structure.employee;
    if (!employee || employee.employmentStatus === "terminated" || employee.archived?.hrms) {
      skipped += 1;
      continue;
    }
    const { grossEarnings, totalContributions, totalDeductions, netPay } = computeTotals(structure.components);
    const snapshot = await buildSnapshot(employee, structure, m, y);
    try {
      const payslip = await Payslip.create({
        employee: employee._id, month: m, year: y, components: structure.components,
        grossEarnings, totalContributions, totalDeductions, netPay, generatedBy: req.user._id,
        ...snapshot,
      });
      generated += 1;
      writeAuditLog({
        type: "database", event: "hrms.payslip.generated", action: "hrms.payslip.generated",
        actorId: req.user._id, targetId: payslip._id, oldValue: null, newValue: { month: m, year: y, netPay, bulk: true },
      });
      notifyPayslipGenerated(payslip, employee);
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

const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");

// Draws the full payslip layout onto an already-created PDFDocument, without
// calling .end() — shared by the HTTP download endpoint (streams straight to
// the response) and the "payslip generated" email (renders to a Buffer to
// attach), so the layout only lives in one place.
const drawPayslipPdf = (doc, payslip) => {
  const left = 40;
  const right = 555;
  const fullWidth = right - left;
  const half = fullWidth / 2;

  // Header: title + company letterhead on the left, itRadiant logo block on
  // the right — drawn at fixed coordinates so it doesn't interleave with the
  // left column's flowing cursor, then the cursor continues below whichever
  // block is taller.
  const headerTop = doc.y;

  doc.font("Helvetica-Bold").fontSize(20).fillColor("#111").text("PAYSLIP ", left, headerTop, { continued: true });
  doc.font("Helvetica").fontSize(13).fillColor("#555").text(`${MONTH_NAMES[payslip.month - 1].toUpperCase()} ${payslip.year}`);
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#111").text(COMPANY.name);
  doc.font("Helvetica").fontSize(9).fillColor("#666");
  COMPANY.addressLines.forEach((line) => doc.text(line));
  const leftBlockBottom = doc.y;

  try {
    const logoSize = 30;
    const logoX = right - 175;
    doc.image(LOGO_PATH, logoX, headerTop, { width: logoSize, height: logoSize });
    doc.font("Helvetica").fontSize(9).fillColor("#666").text("IT", logoX + logoSize + 6, headerTop + 2, { continued: true });
    doc.font("Times-Bold").fontSize(20).fillColor("#1b3a6b").text("Radiant");
    doc.font("Helvetica-Oblique").fontSize(7.5).fillColor("#888").text("Enabling the enterprise of the future", logoX + logoSize + 6, headerTop + 24, { width: 145 });
    doc.font("Helvetica-BoldOblique").fontSize(7.5).fillColor("#1b3a6b").text("A CMMI Level 3 Company", logoX + logoSize + 6, headerTop + 34, { width: 145 });
  } catch {
    // Missing/unreadable logo asset shouldn't block payslip generation.
  }

  // Reset the cursor to the left margin — the logo block's .text() calls
  // above leave doc.x parked on the right side of the page otherwise.
  doc.x = left;
  doc.y = Math.max(leftBlockBottom, headerTop + 45);
  doc.moveDown(1);

  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#ddd").stroke();
  doc.moveDown(0.8);

  // Employee name + info grid (2 columns x N rows, matching the sample).
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111").text(payslip.employee.name.toUpperCase());
  doc.moveDown(0.6);

  const gridField = (label, value, x, y, width) => {
    doc.font("Helvetica").fontSize(8).fillColor("#888").text(label, x, y, { width });
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#111").text(value || "—", x, y + 11, { width });
  };

  const col1 = left;
  const col2 = left + half;
  let gridY = doc.y;
  gridField("Employee Number", payslip.employeeNumber, col1, gridY, half - 10);
  gridField("Department", payslip.department, col2, gridY, half - 10);
  gridY += 32;
  gridField("Designation", payslip.designation, col1, gridY, half - 10);
  gridField("Payment Mode", PAYMENT_MODE_LABELS[payslip.paymentMode] || payslip.paymentMode, col2, gridY, half - 10);
  gridY += 32;
  gridField("UAN", payslip.uan, col1, gridY, half - 10);
  gridField("Pay Cycle Dates", `01 ${MONTH_NAMES[payslip.month - 1].slice(0, 3)} - ${payslip.totalWorkingDays} ${MONTH_NAMES[payslip.month - 1].slice(0, 3)}`, col2, gridY, half - 10);
  gridY += 32;
  gridField("Monthly Salary", payslip.monthlySalary ? fmt(payslip.monthlySalary) : "—", col1, gridY, half - 10);
  gridField("Date Of Birth", fmtDate(payslip.dateOfBirth), col2, gridY, half - 10);
  gridY += 32;
  gridField("Location", payslip.location, col1, gridY, half - 10);
  gridField("PAN Number", payslip.panNumber, col2, gridY, half - 10);
  gridY += 34;

  doc.y = gridY;
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#ddd").stroke();
  doc.moveDown(0.8);

  // Salary details row.
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#111").text("SALARY DETAILS");
  doc.moveDown(0.5);
  const detailY = doc.y;
  const detailWidth = fullWidth / 4;
  const details = [
    ["Actual Payable Days", payslip.actualPayableDays.toFixed(1)],
    ["Total Working Days", payslip.totalWorkingDays.toFixed(1)],
    ["Loss Of Pay Days", payslip.lossOfPayDays.toFixed(2)],
    ["Days Payable", String(payslip.daysPayable)],
  ];
  details.forEach(([label, value], i) => gridField(label, value, left + i * detailWidth, detailY, detailWidth - 8));
  doc.y = detailY + 32;
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#ddd").stroke();
  doc.moveDown(0.8);

  // Two-column EARNINGS vs CONTRIBUTIONS + TAXES & DEDUCTIONS.
  const earnings = payslip.components.filter((c) => c.type === "earning");
  const contributions = payslip.components.filter((c) => c.type === "contribution");
  const deductions = payslip.components.filter((c) => c.type === "deduction");

  const sectionTop = doc.y;
  const colWidth = half - 10;

  const renderColumn = (x, startY, sections) => {
    let y = startY;
    sections.forEach(({ title, rows, total }) => {
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#111").text(title, x, y, { width: colWidth });
      y += 16;
      rows.forEach((c) => {
        doc.font("Helvetica").fontSize(9.5).fillColor("#333").text(c.name, x, y, { width: colWidth - 70 });
        doc.text(fmt(c.amount), x + colWidth - 70, y, { width: 70, align: "right" });
        y += 15;
      });
      if (rows.length === 0) {
        doc.font("Helvetica-Oblique").fontSize(9).fillColor("#aaa").text("None", x, y, { width: colWidth });
        y += 15;
      }
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#111").text(total.label, x, y, { width: colWidth - 70 });
      doc.text(fmt(total.value), x + colWidth - 70, y, { width: 70, align: "right" });
      y += 20;
    });
    return y;
  };

  const leftBottom = renderColumn(left, sectionTop, [
    { title: "EARNINGS", rows: earnings, total: { label: "Total Earnings (A)", value: payslip.grossEarnings } },
  ]);
  const rightBottom = renderColumn(left + half + 10, sectionTop, [
    { title: "CONTRIBUTIONS", rows: contributions, total: { label: "Total Contributions (B)", value: payslip.totalContributions } },
    { title: "TAXES & DEDUCTIONS", rows: deductions, total: { label: "Total Taxes & Deductions (C)", value: payslip.totalDeductions } },
  ]);

  doc.y = Math.max(leftBottom, rightBottom);
  doc.moveDown(0.3);
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#ddd").stroke();
  doc.moveDown(0.8);

  // Net pay + amount in words.
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111");
  const netY = doc.y;
  doc.text("Net Salary Payable ( A - B - C )", left, netY, { width: fullWidth - 100 });
  doc.text(fmt(payslip.netPay), left + fullWidth - 100, netY, { width: 100, align: "right" });
  doc.moveDown(0.6);
  doc.font("Helvetica").fontSize(9.5).fillColor("#555").text("Net Salary in words", left, doc.y, { continued: true, width: fullWidth });
  doc.font("Helvetica-Bold").text(`   ${numberToIndianWords(payslip.netPay)}`);

  doc.moveDown(1.5);
  doc.font("Helvetica-Oblique").fontSize(8).fillColor("#999");
  doc.text("**Note: All amounts displayed in this payslip are in INR");
  doc.text("* This is a computer generated statement, does not require signature.");
  doc.moveDown(0.5);
  doc.text(`Status: ${payslip.status}${payslip.paidAt ? ` on ${new Date(payslip.paidAt).toDateString()}` : ""}`);
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

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);
  drawPayslipPdf(doc, payslip);
  doc.end();
};

// Renders the same layout to an in-memory Buffer, for emailing as an
// attachment rather than streaming to an HTTP response.
const renderPayslipPdfBuffer = (payslip) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    drawPayslipPdf(doc, payslip);
    doc.end();
  });
