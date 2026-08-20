import crypto from "crypto";
import AttendancePunch from "../models/AttendancePunch.js";
import AttendanceDay from "../models/AttendanceDay.js";
import User from "../models/User.js";
import CompanyHoliday from "../models/CompanyHoliday.js";
import LeaveRequest from "../models/LeaveRequest.js";
import { writeAuditLog } from "../utils/activityLog.js";
import { notifyUsers } from "../utils/notify.js";

// A day counts "present" once worked time (first punch -> last punch) clears
// this; below it but with at least one punch, it's a half day so HR has a
// clear signal to check for a missed punch. No shift model exists yet, so
// these — and the late cutoff below — are fixed defaults, not per-employee.
const FULL_DAY_SECONDS = 8 * 3600;
const HALF_DAY_SECONDS = 4 * 3600;
const LATE_AFTER_MINUTES = 9 * 60 + 30; // 09:30 local

// Matches CompanyHoliday's stored "YYYY-MM-DD" string, in local time — not
// toISOString(), which would shift the date across a UTC boundary.
const toISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

const populateEmployee = (query) =>
  query.populate({
    path: "employee",
    select: "name email department departmentId employeeId",
    populate: { path: "departmentId", select: "name" },
  });

// Pure so it's directly unit-testable without touching the DB.
export function computeDayFields(punches, { isHoliday, isOnLeave, isWeekendDay }) {
  const sorted = [...punches].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const punchCount = sorted.length;
  const firstIn = punchCount ? sorted[0].timestamp : null;
  const lastOut = punchCount ? sorted[punchCount - 1].timestamp : null;
  const workedSeconds = punchCount >= 2 ? Math.max(0, (new Date(lastOut) - new Date(firstIn)) / 1000) : 0;

  let status;
  if (isWeekendDay) status = "weekend";
  else if (isHoliday) status = "holiday";
  else if (isOnLeave) status = "on_leave";
  else if (punchCount === 0) status = "absent";
  else if (workedSeconds >= FULL_DAY_SECONDS) status = "present";
  else status = "half_day";

  let isLate = false;
  if (firstIn && (status === "present" || status === "half_day")) {
    const d = new Date(firstIn);
    isLate = d.getHours() * 60 + d.getMinutes() > LATE_AFTER_MINUTES;
  }

  return { firstIn, lastOut, workedSeconds, punchCount, status, isLate };
}

async function recomputeDay(employeeId, dateStr) {
  const dayStart = new Date(`${dateStr}T00:00:00`);
  const dayEnd = new Date(`${dateStr}T23:59:59.999`);

  const punches = await AttendancePunch.find({
    employee: employeeId,
    timestamp: { $gte: dayStart, $lte: dayEnd },
  }).select("timestamp");

  const [holiday, leave] = await Promise.all([
    CompanyHoliday.findOne({ date: dateStr }).select("_id"),
    LeaveRequest.findOne({ employee: employeeId, status: "approved", startDate: { $lte: dayEnd }, endDate: { $gte: dayStart } }).select("_id"),
  ]);

  const fields = computeDayFields(punches, {
    isHoliday: Boolean(holiday),
    isOnLeave: Boolean(leave),
    isWeekendDay: isWeekend(dayStart),
  });

  const day = await AttendanceDay.findOneAndUpdate(
    { employee: employeeId, date: dateStr },
    { $set: fields },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return day;
}

// Device-facing punch ingest — POST /hrms/attendance/punch, gated by
// requireDeviceApiKey, not a user JWT. Payload shape matches the eSSL/ZKTeco
// iClock ADMS connector's hrmsClient.sendPunch() as-is: employeeCode maps to
// User.employeeId. Always responds 2xx once the punch is durably stored, even
// when unmapped, so the connector's retry queue doesn't spin on a mapping
// problem it can't fix by resending.
export const recordPunch = async (req, res) => {
  const { employeeCode, timestamp, direction, deviceSerial, devicePin, verifyMode, source } = req.body;
  if (!employeeCode || !timestamp) {
    return res.status(400).json({ message: "employeeCode and timestamp are required" });
  }

  const punchTime = new Date(timestamp);
  if (Number.isNaN(punchTime.getTime())) {
    return res.status(400).json({ message: "timestamp is not a valid date" });
  }

  const employee = await User.findOne({ employeeId: String(employeeCode) }).select("_id");

  const dedupKey = crypto
    .createHash("sha1")
    .update(`${deviceSerial || ""}|${devicePin || employeeCode}|${timestamp}|${direction || ""}`)
    .digest("hex");

  const punch = await AttendancePunch.findOneAndUpdate(
    { dedupKey },
    {
      $setOnInsert: {
        employee: employee?._id || null,
        employeeCode: String(employeeCode),
        timestamp: punchTime,
        direction: ["IN", "OUT"].includes(direction) ? direction : "UNKNOWN",
        source: source || "UNKNOWN_DEVICE",
        deviceSerial: deviceSerial || "",
        devicePin: devicePin || "",
        verifyMode: verifyMode || "",
        dedupKey,
      },
    },
    { upsert: true, new: true },
  );

  if (employee) await recomputeDay(employee._id, toISODate(punchTime));

  res.status(201).json({ ok: true, matched: Boolean(employee), punchId: punch._id });
};

// HR-entered punch for a missed/failed device scan — same pipeline as
// recordPunch minus the device framing, so both paths stay in sync.
export const manualPunch = async (req, res) => {
  const { employeeId, timestamp, direction } = req.body;
  if (!employeeId || !timestamp) return res.status(400).json({ message: "employeeId and timestamp are required" });

  const employee = await User.findById(employeeId).select("_id employeeId");
  if (!employee) return res.status(404).json({ message: "Employee not found" });

  const punchTime = new Date(timestamp);
  if (Number.isNaN(punchTime.getTime())) return res.status(400).json({ message: "timestamp is not a valid date" });

  const punch = await AttendancePunch.create({
    employee: employee._id,
    employeeCode: employee.employeeId || "",
    timestamp: punchTime,
    direction: ["IN", "OUT"].includes(direction) ? direction : "UNKNOWN",
    source: "MANUAL",
    createdBy: req.user._id,
  });

  const day = await recomputeDay(employee._id, toISODate(punchTime));

  writeAuditLog({
    type: "database", event: "hrms.attendance.manualPunch", action: "hrms.attendance.manualPunch",
    actorId: req.user._id, targetId: punch._id, oldValue: null, newValue: { employee: employee._id, timestamp, direction },
  });

  res.status(201).json({ punch, day });
};

// HR/manager monitoring list — GET /hrms/attendance?from&to&employeeId&department&status
// Managers only ever see their own reports; HR (and super admins) see everyone.
export const listAttendance = async (req, res) => {
  const { from, to, employeeId, department, status, page, limit } = req.query;
  if (!from || !to) return res.status(400).json({ message: "from and to (YYYY-MM-DD) are required" });

  const filter = { date: { $gte: from, $lte: to } };
  if (status?.trim()) filter.status = status.trim();

  if (employeeId) {
    filter.employee = employeeId;
  } else if (req.user.roles?.hrms === "manager" && !req.user.isSuperAdmin) {
    const reports = await User.find({ managerId: req.user._id }).select("_id");
    filter.employee = { $in: reports.map((r) => r._id) };
  }

  if (department?.trim()) {
    const inDept = await User.find({ department: department.trim() }).select("_id");
    const deptIds = inDept.map((u) => u._id.toString());
    filter.employee = filter.employee
      ? { $in: (filter.employee.$in || [filter.employee]).filter((id) => deptIds.includes(id.toString())) }
      : { $in: deptIds };
  }

  let query = populateEmployee(AttendanceDay.find(filter)).sort({ date: -1, "employee.name": 1 });

  const pageSize = limit ? Math.min(200, Math.max(1, parseInt(limit, 10) || 0)) : null;
  if (pageSize) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const total = await AttendanceDay.countDocuments(filter);
    query = query.skip((pageNum - 1) * pageSize).limit(pageSize);
    res.setHeader("X-Total-Count", total);
  }

  res.json(await query);
};

// HR/manager dashboard widget — GET /hrms/attendance/summary?date=YYYY-MM-DD
export const getDailySummary = async (req, res) => {
  const date = req.query.date || toISODate(new Date());

  const scope = { "archived.account": { $ne: true }, "archived.hrms": { $ne: true } };
  if (req.user.roles?.hrms === "manager" && !req.user.isSuperAdmin) {
    scope.managerId = req.user._id;
  }
  const totalActive = await User.countDocuments(scope);

  const counts = await AttendanceDay.aggregate([
    { $match: { date } },
    { $lookup: { from: "users", localField: "employee", foreignField: "_id", as: "u" } },
    { $unwind: "$u" },
    { $match: req.user.roles?.hrms === "manager" && !req.user.isSuperAdmin ? { "u.managerId": req.user._id } : {} },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  const recorded = counts.reduce((sum, c) => sum + c.count, 0);
  res.json({ date, totalActive, notYetRecorded: Math.max(0, totalActive - recorded), byStatus });
};

// Raw punch drill-down for one employee/day — GET /hrms/attendance/:employeeId/punches?date=
export const getEmployeePunches = async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: "date (YYYY-MM-DD) is required" });

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59.999`);
  const punches = await AttendancePunch.find({
    employee: req.params.employeeId,
    timestamp: { $gte: dayStart, $lte: dayEnd },
  }).sort({ timestamp: 1 });

  res.json(punches);
};

// Employee's own attendance — GET /hrms/attendance/mine?month=YYYY-MM
export const getMyAttendance = async (req, res) => {
  const month = req.query.month || toISODate(new Date()).slice(0, 7);
  const days = await AttendanceDay.find({
    employee: req.user._id,
    date: { $gte: `${month}-01`, $lte: `${month}-31` },
  }).sort({ date: 1 });
  res.json(days);
};

// HR correction for a day missing/wrong punches — PATCH /hrms/attendance/:id/regularize
export const regularizeDay = async (req, res) => {
  const { status, note } = req.body;
  const ALLOWED = ["present", "half_day", "absent", "on_leave", "holiday", "weekend"];
  if (!ALLOWED.includes(status)) return res.status(400).json({ message: `status must be one of: ${ALLOWED.join(", ")}` });

  const day = await AttendanceDay.findById(req.params.id);
  if (!day) return res.status(404).json({ message: "Attendance record not found" });

  const oldValue = { status: day.status, isRegularized: day.isRegularized };
  day.status = status;
  day.isRegularized = true;
  day.regularizedBy = req.user._id;
  day.regularizedAt = new Date();
  day.regularizationNote = note?.trim() || "";
  await day.save();

  writeAuditLog({
    type: "database", event: "hrms.attendance.regularized", action: "hrms.attendance.regularized",
    actorId: req.user._id, targetId: day._id, oldValue, newValue: { status, note: day.regularizationNote },
  });

  notifyUsers([day.employee], {
    title: "Attendance updated",
    message: `Your attendance for ${day.date} was updated to "${status.replace(/_/g, " ")}" by HR.`,
    type: "attendanceRegularized",
    activityType: "update",
    performedBy: req.user._id,
  });

  res.json(await populateEmployee(AttendanceDay.findById(day._id)));
};
