import LeaveRequest from "../models/LeaveRequest.js";
import LeaveType from "../models/LeaveType.js";
import LeaveGrant from "../models/LeaveGrant.js";
import User from "../models/User.js";
import CompanyHoliday from "../models/CompanyHoliday.js";
import { uploadAttachment, createReadUrl } from "../config/blobStorage.js";
import { writeAuditLog } from "../utils/activityLog.js";
import { notifyUsers } from "../utils/notify.js";
import { sendHrmsEmail } from "../utils/hrmsMailer.js";

const ACTIVE_STATUSES = ["pending_manager", "pending_skip_level", "approved"];

const populateRequest = (query) =>
  query
    .populate({
      path: "employee",
      select: "name email managerId",
      populate: { path: "managerId", select: "name email managerId" },
    })
    .populate("leaveType", "name code")
    .populate("decidedBy", "name email")
    .populate("managerDecision.by", "name email");

const startOfDay = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

// Matches CompanyHoliday's stored "YYYY-MM-DD" string, in local time — not
// toISOString(), which would shift the date across a UTC boundary.
const toISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

// Working days only — weekends and TimeFlow's company holiday calendar are
// excluded, rather than duplicating a second holiday list in HRMS.
const countWorkingDays = async (start, end) => {
  const holidayDocs = await CompanyHoliday.find({ date: { $gte: toISODate(start), $lte: toISODate(end) } }).select("date");
  const holidays = new Set(holidayDocs.map((h) => h.date));

  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    if (!isWeekend(cursor) && !holidays.has(toISODate(cursor))) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

const isNonWorkingDay = async (date) => {
  if (isWeekend(date)) return true;
  const holiday = await CompanyHoliday.findOne({ date: toISODate(date) }).select("_id");
  return Boolean(holiday);
};

const hrUserIds = async () => (await User.find({ "roles.hrms": "hr" }).select("_id")).map((u) => u._id);

// The date accrual starts counting from for a given calendar year — Jan 1,
// or the employee's joining date if they joined later that same year.
const effectiveStartFor = (joiningDate, year) => {
  const yearStart = new Date(year, 0, 1);
  return joiningDate && joiningDate > yearStart ? joiningDate : yearStart;
};

// Each month's accrual amount, rounded to the nearest half day — shared by
// computeAccrual and the ledger so a run of monthly entries always sums to
// exactly the same total the balance card shows.
const monthlyIncrement = (annualDays) => Math.round((annualDays / 12) * 2) / 2;

// Accrual as of `asOf`. "yearly" leave types grant the full annual quota in
// one lump as soon as the year (or the employee's joining date) has started;
// "monthly" types pro-rate across the months elapsed, capped at 12.
const computeAccrual = (leaveType, joiningDate, asOf) => {
  const effectiveStart = effectiveStartFor(joiningDate, asOf.getFullYear());
  if (effectiveStart > asOf) return 0;

  if (leaveType.accrualType === "yearly") return leaveType.defaultDaysPerYear;

  const monthsElapsed = (asOf.getFullYear() - effectiveStart.getFullYear()) * 12 + (asOf.getMonth() - effectiveStart.getMonth()) + 1;
  return monthlyIncrement(leaveType.defaultDaysPerYear) * Math.min(monthsElapsed, 12);
};

// How many of last year's unused days roll into `year`, per the leave type's
// carryForwardMode: none of it, half of it (rounded to the nearest half
// day), all of it, or capped at carryForwardCap. Approximates last year's
// allocation using the type's *current* defaultDaysPerYear — the model
// doesn't keep a history of past allocations, so a mid-year policy change
// won't retroactively apply.
const computeCarryForward = async (employeeId, leaveType, year, joiningDate) => {
  const mode = leaveType.carryForwardMode || "none";
  if (mode === "none") return 0;

  const prevYearStart = new Date(year - 1, 0, 1);
  const prevYearEnd = new Date(year - 1, 11, 31, 23, 59, 59, 999);
  if (joiningDate && joiningDate > prevYearEnd) return 0;

  const prevYearAllocated = computeAccrual(leaveType, joiningDate, prevYearEnd);
  const prevYearRequests = await LeaveRequest.find({
    employee: employeeId,
    leaveType: leaveType._id,
    status: { $in: ACTIVE_STATUSES },
    startDate: { $gte: prevYearStart, $lte: prevYearEnd },
  }).select("paidDays");
  const prevYearUsed = prevYearRequests.reduce((sum, r) => sum + r.paidDays, 0);
  const remaining = Math.max(0, prevYearAllocated - prevYearUsed);

  if (mode === "half") return Math.round((remaining / 2) * 2) / 2;
  if (mode === "all") return remaining;
  return Math.min(leaveType.carryForwardCap, remaining); // fixed_cap
};

// "used" only counts paidDays — a loss-of-pay portion doesn't draw down the
// paid balance (it wasn't payable in the first place).
// Manual credits HR granted this calendar year (e.g. Comp-Off for weekend
// work) — for leave types like Comp-Off/Election Day that otherwise accrue
// nothing on their own, this is the only way a balance ever goes above zero.
const grantedDaysFor = async (employeeId, leaveTypeId, year) => {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  const grants = await LeaveGrant.find({
    employee: employeeId, leaveType: leaveTypeId, createdAt: { $gte: yearStart, $lte: yearEnd },
  }).select("days");
  return grants.reduce((sum, g) => sum + g.days, 0);
};

const balanceForType = async (employeeId, joiningDate, leaveType, asOf = new Date()) => {
  const year = asOf.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  const [carriedForward, granted, requests] = await Promise.all([
    computeCarryForward(employeeId, leaveType, year, joiningDate),
    grantedDaysFor(employeeId, leaveType._id, year),
    LeaveRequest.find({
      employee: employeeId,
      leaveType: leaveType._id,
      status: { $in: ACTIVE_STATUSES },
      startDate: { $gte: yearStart, $lte: yearEnd },
    }).select("paidDays"),
  ]);

  const used = requests.reduce((sum, r) => sum + r.paidDays, 0);
  const accrued = computeAccrual(leaveType, joiningDate, asOf);
  const allocated = accrued + carriedForward + granted;
  return { accrued, carriedForward, granted, allocated, used, remaining: allocated - used };
};

// Self-service requests can't overlap another active request for the same
// employee, of any type — this is what actually prevents e.g. Sick Leave and
// Paid Leave being applied for the same day, without hardcoding those two
// types specifically. HR-on-behalf submissions skip this check, since HR
// needs to be able to enter/correct overlapping records.
const hasOverlappingRequest = async (employeeId, start, end) => {
  const existing = await LeaveRequest.findOne({
    employee: employeeId,
    status: { $in: ACTIVE_STATUSES },
    startDate: { $lte: end },
    endDate: { $gte: start },
  }).select("_id");
  return Boolean(existing);
};

// Shared by both createLeaveRequest (self-service) and
// createLeaveRequestForEmployee (HR-on-behalf) — everything about validating
// and creating a request is identical between them except who the request is
// for and whether overlapping requests are allowed.
const submitLeaveRequest = async (req, res, { employee, allowOverlap }) => {
  const { leaveType, startDate, endDate, isHalfDay, halfDaySession, reason } = req.body;
  if (!leaveType) return res.status(400).json({ message: "leaveType is required" });
  if (!startDate || !endDate) return res.status(400).json({ message: "startDate and endDate are required" });

  const type = await LeaveType.findById(leaveType);
  if (!type || !type.isActive) return res.status(400).json({ message: "Invalid or inactive leave type" });
  if (type.requiresDocument && !req.file) {
    return res.status(400).json({ message: `${type.name} requires a supporting document to be attached` });
  }

  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  if (start > end) return res.status(400).json({ message: "startDate cannot be after endDate" });

  if (!allowOverlap && (await hasOverlappingRequest(employee._id, start, end))) {
    return res.status(409).json({ message: "This overlaps an existing leave request for one or more of these dates" });
  }

  let totalDays;
  if (isHalfDay) {
    if (start.getTime() !== end.getTime()) {
      return res.status(400).json({ message: "A half-day leave must have the same start and end date" });
    }
    if (!["first_half", "second_half"].includes(halfDaySession)) {
      return res.status(400).json({ message: "halfDaySession must be 'first_half' or 'second_half'" });
    }
    if (await isNonWorkingDay(start)) {
      return res.status(400).json({ message: "That date is a weekend or company holiday" });
    }
    totalDays = 0.5;
  } else {
    totalDays = await countWorkingDays(start, end);
    if (totalDays === 0) {
      return res.status(400).json({ message: "That date range has no working days (weekends/holidays only)" });
    }
  }

  const balance = await balanceForType(employee._id, employee.joiningDate, type, start);
  const paidDays = Math.max(0, Math.min(totalDays, balance.remaining));
  const lopDays = totalDays - paidDays;

  const leaveRequest = await LeaveRequest.create({
    employee: employee._id,
    leaveType,
    startDate: start,
    endDate: end,
    isHalfDay: Boolean(isHalfDay),
    halfDaySession: isHalfDay ? halfDaySession : null,
    totalDays,
    paidDays,
    lopDays,
    reason: reason?.trim() || "",
    appliedBy: req.user._id,
  });

  if (req.file) {
    const uploaded = await uploadAttachment({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      scope: "hrms-leave-document",
      parentId: leaveRequest._id.toString(),
    });
    leaveRequest.documentBlobName = uploaded.blobName;
    leaveRequest.documentFileName = req.file.originalname;
    await leaveRequest.save();
  }

  writeAuditLog({
    type: "database", event: "hrms.leaveRequest.created", action: "hrms.leaveRequest.created",
    actorId: req.user._id, targetId: leaveRequest._id, oldValue: null,
    newValue: { status: "pending_manager", totalDays, lopDays, employee: employee._id.toString() },
  });

  const approverIds = employee.managerId ? [employee.managerId] : await hrUserIds();
  const approvers = await User.find({ _id: { $in: approverIds } }).select("email");
  const lopNote = lopDays > 0 ? ` (${lopDays} day(s) will be unpaid — beyond their balance)` : "";
  notifyUsers(approverIds, {
    title: "New leave request",
    message: `${employee.name} applied for ${totalDays} day(s) of ${type.name} leave.${lopNote}`,
    type: "leaveRequestSubmitted",
    activityType: "create",
    performedBy: req.user._id,
  });
  approvers.forEach((a) => sendHrmsEmail(
    a.email, "New leave request awaiting your approval", "Leave request submitted",
    `<p><strong>${employee.name}</strong> applied for <strong>${totalDays} day(s)</strong> of ${type.name} leave` +
      `${lopDays > 0 ? `, of which <strong>${lopDays}</strong> would be unpaid (beyond their balance)` : ""}.</p>` +
      `<p>Dates: ${toISODate(start)}${start.getTime() !== end.getTime() ? ` – ${toISODate(end)}` : ""}</p>`,
  ));

  res.status(201).json(await populateRequest(LeaveRequest.findById(leaveRequest._id)));
};

export const createLeaveRequest = (req, res) => submitLeaveRequest(req, res, { employee: req.user, allowOverlap: false });

// HR applying leave on an employee's behalf — e.g. entering a combined
// sick+paid period the employee couldn't submit themselves as one
// self-service request, since overlapping requests are blocked there.
export const createLeaveRequestForEmployee = async (req, res) => {
  if (req.user.roles.hrms !== "hr") return res.status(403).json({ message: "Forbidden" });
  const { employeeId } = req.body;
  if (!employeeId) return res.status(400).json({ message: "employeeId is required" });

  const employee = await User.findById(employeeId).select("name email managerId joiningDate");
  if (!employee) return res.status(404).json({ message: "Employee not found" });

  await submitLeaveRequest(req, res, { employee, allowOverlap: true });
};

export const getLeaveDocumentUrl = async (req, res) => {
  const leaveRequest = await LeaveRequest.findById(req.params.id).select("employee documentBlobName documentFileName");
  if (!leaveRequest) return res.status(404).json({ message: "Leave request not found" });

  const isOwner = leaveRequest.employee.toString() === req.user._id.toString();
  const canView = req.user.roles.hrms === "hr" || req.user.roles.hrms === "manager" || isOwner;
  if (!canView) return res.status(403).json({ message: "Forbidden" });
  if (!leaveRequest.documentBlobName) return res.status(404).json({ message: "No document attached to this request" });

  res.json({ url: createReadUrl(leaveRequest.documentBlobName), fileName: leaveRequest.documentFileName });
};

export const listMyLeaveRequests = async (req, res) => {
  const filter = { employee: req.user._id };
  if (req.query.status?.trim()) filter.status = req.query.status.trim();
  const requests = await populateRequest(LeaveRequest.find(filter)).sort({ createdAt: -1 });
  res.json(requests);
};

// A manager's approval queue — their direct reports (stage-one approvals)
// plus their reports' reports, for whom this manager is the skip-level
// approver (stage-two approvals).
export const listTeamLeaveRequests = async (req, res) => {
  const directReports = await User.find({ managerId: req.user._id }).select("_id");
  const directReportIds = directReports.map((r) => r._id);
  const skipLevelReports = await User.find({ managerId: { $in: directReportIds } }).select("_id");

  const filter = { employee: { $in: [...directReportIds, ...skipLevelReports.map((r) => r._id)] } };
  if (req.query.status?.trim()) filter.status = req.query.status.trim();
  const requests = await populateRequest(LeaveRequest.find(filter)).sort({ createdAt: -1 });
  res.json(requests);
};

export const listLeaveRequests = async (req, res) => {
  if (req.user.roles.hrms !== "hr") return res.status(403).json({ message: "Forbidden" });
  const filter = {};
  if (req.query.status?.trim()) filter.status = req.query.status.trim();
  if (req.query.employee?.trim()) filter.employee = req.query.employee.trim();
  const requests = await populateRequest(LeaveRequest.find(filter)).sort({ createdAt: -1 });
  res.json(requests);
};

export const getMyLeaveBalance = async (req, res) => {
  const now = new Date();
  const types = await LeaveType.find({ isActive: true });
  const balances = await Promise.all(
    types.map(async (t) => ({ leaveType: t, ...(await balanceForType(req.user._id, req.user.joiningDate, t, now)) })),
  );
  res.json(balances);
};

// HR-only equivalent of getMyLeaveBalance, for the employee profile summary.
export const getLeaveBalanceForEmployee = async (req, res) => {
  const employee = await User.findById(req.params.employeeId).select("joiningDate");
  if (!employee) return res.status(404).json({ message: "Employee not found" });

  const now = new Date();
  const types = await LeaveType.find({ isActive: true });
  const balances = await Promise.all(
    types.map(async (t) => ({ leaveType: t, ...(await balanceForType(employee._id, employee.joiningDate, t, now)) })),
  );
  res.json(balances);
};

// A chronological statement of every balance-affecting event for one
// employee/leaveType/year — accrual credits (one lump for "yearly" types,
// one entry per elapsed month for "monthly") plus a debit per leave request,
// each carrying the running balance. Mirrors a bank-statement-style leave
// ledger rather than just the current total.
const buildLedger = async (employeeId, joiningDate, leaveType, year) => {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  const effectiveStart = effectiveStartFor(joiningDate, year);
  const now = new Date();

  const entries = [];

  const carriedForward = await computeCarryForward(employeeId, leaveType, year, joiningDate);
  if (carriedForward > 0) {
    entries.push({ date: effectiveStart, change: carriedForward, reason: "Carried forward from last year" });
  }

  if (effectiveStart <= now) {
    if (leaveType.accrualType === "yearly") {
      entries.push({ date: effectiveStart, change: leaveType.defaultDaysPerYear, reason: "Leave accrual allocated at the start of year" });
    } else {
      const increment = monthlyIncrement(leaveType.defaultDaysPerYear);
      const cursor = new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), 1);
      while (cursor <= yearEnd && cursor <= now) {
        entries.push({ date: new Date(cursor), change: increment, reason: "Monthly leave accrual" });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
  }

  const requests = await LeaveRequest.find({
    employee: employeeId,
    leaveType: leaveType._id,
    status: { $in: ACTIVE_STATUSES },
    startDate: { $gte: yearStart, $lte: yearEnd },
  }).sort({ startDate: 1 });
  requests.forEach((r) => {
    if (r.paidDays > 0) {
      const lopNote = r.lopDays > 0 ? ` (${r.lopDays} day(s) unpaid)` : "";
      entries.push({ date: r.startDate, change: -r.paidDays, reason: `Leave taken — ${r.status}${lopNote}`, requestId: r._id });
    }
  });

  const grants = await LeaveGrant.find({
    employee: employeeId, leaveType: leaveType._id, createdAt: { $gte: yearStart, $lte: yearEnd },
  }).sort({ createdAt: 1 });
  grants.forEach((g) => {
    entries.push({ date: g.createdAt, change: g.days, reason: g.reason ? `Manually granted — ${g.reason}` : "Manually granted by HR" });
  });

  entries.sort((a, b) => a.date - b.date);
  let running = 0;
  return entries.map((e) => { running += e.change; return { ...e, balance: running }; });
};

export const getLeaveLedger = async (req, res) => {
  const { leaveTypeId } = req.params;
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

  let employeeId = req.user._id;
  let joiningDate = req.user.joiningDate;
  if (req.query.employeeId && req.query.employeeId !== req.user._id.toString()) {
    if (req.user.roles.hrms !== "hr") return res.status(403).json({ message: "Forbidden" });
    const employee = await User.findById(req.query.employeeId).select("joiningDate");
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    employeeId = employee._id;
    joiningDate = employee.joiningDate;
  }

  const leaveType = await LeaveType.findById(leaveTypeId);
  if (!leaveType) return res.status(404).json({ message: "Leave type not found" });

  const entries = await buildLedger(employeeId, joiningDate, leaveType, year);
  res.json({ leaveType, entries });
};

// HR-only manual balance credit — e.g. a Comp-Off day for weekend/holiday
// work, or an ad-hoc Election Day grant. This is the only way a leave type
// with no accrual of its own (defaultDaysPerYear: 0) ever has a balance.
export const grantLeave = async (req, res) => {
  const { employeeId, leaveTypeId, days, reason } = req.body;
  if (!employeeId || !leaveTypeId) return res.status(400).json({ message: "employeeId and leaveTypeId are required" });
  const daysNum = Number(days);
  if (!Number.isFinite(daysNum) || daysNum <= 0) return res.status(400).json({ message: "days must be a positive number" });

  const [employee, leaveType] = await Promise.all([
    User.findById(employeeId).select("name email"),
    LeaveType.findById(leaveTypeId),
  ]);
  if (!employee) return res.status(404).json({ message: "Employee not found" });
  if (!leaveType || !leaveType.isActive) return res.status(400).json({ message: "Invalid or inactive leave type" });

  const grant = await LeaveGrant.create({
    employee: employeeId, leaveType: leaveTypeId, days: daysNum, reason: reason?.trim() || "", grantedBy: req.user._id,
  });

  writeAuditLog({
    type: "database", event: "hrms.leaveGrant.created", action: "hrms.leaveGrant.created",
    actorId: req.user._id, targetId: grant._id, oldValue: null, newValue: { employee: employeeId, leaveType: leaveTypeId, days: daysNum },
  });
  notifyUsers([employeeId], {
    title: "Leave balance credited",
    message: `HR credited you ${daysNum} day(s) of ${leaveType.name}${reason ? `: ${reason.trim()}` : ""}.`,
    type: "leaveGranted",
    activityType: "create",
    performedBy: req.user._id,
  });
  sendHrmsEmail(
    employee.email, `${daysNum} day(s) of ${leaveType.name} credited to your balance`, "Leave balance credited",
    `<p>Hi ${employee.name}, HR credited <strong>${daysNum} day(s)</strong> of <strong>${leaveType.name}</strong> to your balance${reason ? `: ${reason.trim()}` : ""}.</p>`,
  );

  res.status(201).json(grant);
};

// Company-wide "who's out" view — any authenticated hrms user can see it
// (names + dates only, no reason), same as a shared team calendar in Keka.
export const getLeaveCalendar = async (req, res) => {
  const month = Number(req.query.month);
  const year = Number(req.query.year);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    return res.status(400).json({ message: "month (1-12) and year are required" });
  }
  const rangeStart = new Date(year, month - 1, 1);
  const rangeEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const requests = await LeaveRequest.find({
    status: "approved",
    startDate: { $lte: rangeEnd },
    endDate: { $gte: rangeStart },
  })
    .populate("employee", "name")
    .populate("leaveType", "name")
    .select("employee leaveType startDate endDate isHalfDay")
    .sort({ startDate: 1 });

  res.json(requests);
};

const canDecideStage = (leaveRequest, user) => {
  if (user.roles.hrms === "hr") return true;
  if (user.roles.hrms !== "manager") return false;
  if (leaveRequest.status === "pending_manager") {
    return leaveRequest.employee.managerId?._id?.toString() === user._id.toString();
  }
  if (leaveRequest.status === "pending_skip_level") {
    return leaveRequest.employee.managerId?.managerId?.toString() === user._id.toString();
  }
  return false;
};

export const reviewLeaveRequest = async (req, res) => {
  const { action, comment } = req.body;
  if (!["approve", "reject"].includes(action)) {
    return res.status(400).json({ message: "action must be 'approve' or 'reject'" });
  }

  const leaveRequest = await populateRequest(LeaveRequest.findById(req.params.id));
  if (!leaveRequest) return res.status(404).json({ message: "Leave request not found" });
  if (!["pending_manager", "pending_skip_level"].includes(leaveRequest.status)) {
    return res.status(409).json({ message: `Cannot review a request with status '${leaveRequest.status}'` });
  }
  if (!canDecideStage(leaveRequest, req.user)) return res.status(403).json({ message: "Forbidden" });

  const oldStatus = leaveRequest.status;
  const isHrOverride = req.user.roles.hrms === "hr";
  const trimmedComment = comment?.trim() || "";

  if (action === "reject") {
    leaveRequest.status = "rejected";
    leaveRequest.decidedBy = req.user._id;
    leaveRequest.decidedAt = new Date();
    leaveRequest.decisionComment = trimmedComment;
  } else if (!isHrOverride && oldStatus === "pending_manager") {
    // Manager sign-off — route to the skip-level manager (or HR, if there
    // isn't one) rather than finalizing.
    leaveRequest.managerDecision = { by: req.user._id, at: new Date(), comment: trimmedComment };
    leaveRequest.status = "pending_skip_level";
  } else {
    // Skip-level sign-off, or an HR override at either stage — final.
    leaveRequest.status = "approved";
    leaveRequest.decidedBy = req.user._id;
    leaveRequest.decidedAt = new Date();
    leaveRequest.decisionComment = trimmedComment;
  }
  await leaveRequest.save();

  writeAuditLog({
    type: "database", event: `hrms.leaveRequest.${leaveRequest.status}`, action: `hrms.leaveRequest.${leaveRequest.status}`,
    actorId: req.user._id, targetId: leaveRequest._id, oldValue: { status: oldStatus }, newValue: { status: leaveRequest.status },
  });

  if (leaveRequest.status === "pending_skip_level") {
    const skipLevelId = leaveRequest.employee.managerId?.managerId;
    const notifyIds = skipLevelId ? [skipLevelId] : await hrUserIds();
    notifyUsers(notifyIds, {
      title: "Leave request needs your approval",
      message: `${leaveRequest.employee.name}'s ${leaveRequest.leaveType.name} leave request needs your final sign-off.`,
      type: "leaveRequestSubmitted",
      activityType: "status_change",
      performedBy: req.user._id,
    });
    const recipients = await User.find({ _id: { $in: notifyIds } }).select("email");
    recipients.forEach((r) => sendHrmsEmail(
      r.email, "Leave request needs your final approval", "Final sign-off needed",
      `<p><strong>${leaveRequest.employee.name}</strong>'s ${leaveRequest.leaveType.name} leave request was approved by their manager and now needs your sign-off.</p>`,
    ));
  } else if (["approved", "rejected"].includes(leaveRequest.status)) {
    notifyUsers([leaveRequest.employee._id], {
      title: `Leave request ${leaveRequest.status}`,
      message: `Your ${leaveRequest.leaveType.name} leave request was ${leaveRequest.status}.`,
      type: leaveRequest.status === "approved" ? "leaveRequestApproved" : "leaveRequestRejected",
      activityType: "status_change",
      performedBy: req.user._id,
    });
    sendHrmsEmail(
      leaveRequest.employee.email, `Your leave request was ${leaveRequest.status}`, `Leave request ${leaveRequest.status}`,
      `<p>Your <strong>${leaveRequest.leaveType.name}</strong> leave request (${toISODate(leaveRequest.startDate)}` +
        `${leaveRequest.startDate.getTime() !== leaveRequest.endDate.getTime() ? ` – ${toISODate(leaveRequest.endDate)}` : ""})` +
        ` was <strong>${leaveRequest.status}</strong>${trimmedComment ? `: "${trimmedComment}"` : "."}</p>`,
    );
  }

  res.json(leaveRequest);
};

export const cancelLeaveRequest = async (req, res) => {
  const leaveRequest = await LeaveRequest.findById(req.params.id);
  if (!leaveRequest) return res.status(404).json({ message: "Leave request not found" });
  if (leaveRequest.employee.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "You can only cancel your own leave requests" });
  }
  const stillPending = ["pending_manager", "pending_skip_level"].includes(leaveRequest.status);
  const cancellable = stillPending || (leaveRequest.status === "approved" && leaveRequest.startDate > new Date());
  if (!cancellable) {
    return res.status(409).json({ message: "Only a pending, or not-yet-started approved, request can be cancelled" });
  }

  const oldStatus = leaveRequest.status;
  leaveRequest.status = "cancelled";
  await leaveRequest.save();

  writeAuditLog({
    type: "database", event: "hrms.leaveRequest.cancelled", action: "hrms.leaveRequest.cancelled",
    actorId: req.user._id, targetId: leaveRequest._id, oldValue: { status: oldStatus }, newValue: { status: "cancelled" },
  });
  res.json(leaveRequest);
};
