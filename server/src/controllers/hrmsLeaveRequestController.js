import LeaveRequest from "../models/LeaveRequest.js";
import LeaveType from "../models/LeaveType.js";
import User from "../models/User.js";
import CompanyHoliday from "../models/CompanyHoliday.js";
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

// Monthly pro-rata accrual as of `asOf`, counted from Jan 1 or the employee's
// joining date (if later), rounded to the nearest half day. A mid-year joiner
// only accrues from their joining month; nobody accrues more than 12 months.
const computeAccrual = (annualDays, joiningDate, asOf) => {
  const year = asOf.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const effectiveStart = joiningDate && joiningDate > yearStart ? joiningDate : yearStart;
  if (effectiveStart > asOf) return 0;
  const monthsElapsed = (asOf.getFullYear() - effectiveStart.getFullYear()) * 12 + (asOf.getMonth() - effectiveStart.getMonth()) + 1;
  const monthlyRate = annualDays / 12;
  return Math.round(monthlyRate * Math.min(monthsElapsed, 12) * 2) / 2;
};

// How many of last year's unused days roll into `year`, capped at the leave
// type's carryForwardCap. Approximates last year's allocation using the
// type's *current* defaultDaysPerYear — the model doesn't keep a history of
// past allocations, so a mid-year policy change won't retroactively apply.
const computeCarryForward = async (employeeId, leaveType, year, joiningDate) => {
  if (!leaveType.carryForwardCap) return 0;
  const prevYearStart = new Date(year - 1, 0, 1);
  const prevYearEnd = new Date(year - 1, 11, 31, 23, 59, 59, 999);
  if (joiningDate && joiningDate > prevYearEnd) return 0;

  const prevYearAllocated = computeAccrual(leaveType.defaultDaysPerYear, joiningDate, prevYearEnd);
  const prevYearRequests = await LeaveRequest.find({
    employee: employeeId,
    leaveType: leaveType._id,
    status: { $in: ACTIVE_STATUSES },
    startDate: { $gte: prevYearStart, $lte: prevYearEnd },
  }).select("paidDays");
  const prevYearUsed = prevYearRequests.reduce((sum, r) => sum + r.paidDays, 0);
  return Math.max(0, Math.min(leaveType.carryForwardCap, prevYearAllocated - prevYearUsed));
};

// "used" only counts paidDays — a loss-of-pay portion doesn't draw down the
// paid balance (it wasn't payable in the first place).
const balanceForType = async (employeeId, joiningDate, leaveType, asOf = new Date()) => {
  const year = asOf.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  const [carriedForward, requests] = await Promise.all([
    computeCarryForward(employeeId, leaveType, year, joiningDate),
    LeaveRequest.find({
      employee: employeeId,
      leaveType: leaveType._id,
      status: { $in: ACTIVE_STATUSES },
      startDate: { $gte: yearStart, $lte: yearEnd },
    }).select("paidDays"),
  ]);

  const used = requests.reduce((sum, r) => sum + r.paidDays, 0);
  const accrued = computeAccrual(leaveType.defaultDaysPerYear, joiningDate, asOf);
  const allocated = accrued + carriedForward;
  return { accrued, carriedForward, allocated, used, remaining: allocated - used };
};

export const createLeaveRequest = async (req, res) => {
  const { leaveType, startDate, endDate, isHalfDay, halfDaySession, reason } = req.body;
  if (!leaveType) return res.status(400).json({ message: "leaveType is required" });
  if (!startDate || !endDate) return res.status(400).json({ message: "startDate and endDate are required" });

  const type = await LeaveType.findById(leaveType);
  if (!type || !type.isActive) return res.status(400).json({ message: "Invalid or inactive leave type" });

  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  if (start > end) return res.status(400).json({ message: "startDate cannot be after endDate" });

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

  const balance = await balanceForType(req.user._id, req.user.joiningDate, type, start);
  const paidDays = Math.max(0, Math.min(totalDays, balance.remaining));
  const lopDays = totalDays - paidDays;

  const leaveRequest = await LeaveRequest.create({
    employee: req.user._id,
    leaveType,
    startDate: start,
    endDate: end,
    isHalfDay: Boolean(isHalfDay),
    halfDaySession: isHalfDay ? halfDaySession : null,
    totalDays,
    paidDays,
    lopDays,
    reason: reason?.trim() || "",
  });

  writeAuditLog({
    type: "database", event: "hrms.leaveRequest.created", action: "hrms.leaveRequest.created",
    actorId: req.user._id, targetId: leaveRequest._id, oldValue: null, newValue: { status: "pending_manager", totalDays, lopDays },
  });

  const approverIds = req.user.managerId ? [req.user.managerId] : await hrUserIds();
  const approvers = await User.find({ _id: { $in: approverIds } }).select("email");
  const lopNote = lopDays > 0 ? ` (${lopDays} day(s) will be unpaid — beyond their balance)` : "";
  notifyUsers(approverIds, {
    title: "New leave request",
    message: `${req.user.name} applied for ${totalDays} day(s) of ${type.name} leave.${lopNote}`,
    type: "leaveRequestSubmitted",
    activityType: "create",
    performedBy: req.user._id,
  });
  approvers.forEach((a) => sendHrmsEmail(
    a.email, "New leave request awaiting your approval", "Leave request submitted",
    `<p><strong>${req.user.name}</strong> applied for <strong>${totalDays} day(s)</strong> of ${type.name} leave` +
      `${lopDays > 0 ? `, of which <strong>${lopDays}</strong> would be unpaid (beyond their balance)` : ""}.</p>` +
      `<p>Dates: ${toISODate(start)}${start.getTime() !== end.getTime() ? ` – ${toISODate(end)}` : ""}</p>`,
  ));

  res.status(201).json(await populateRequest(LeaveRequest.findById(leaveRequest._id)));
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
