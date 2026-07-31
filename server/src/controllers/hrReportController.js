import * as XLSX from "xlsx";
import Timesheet from "../models/Timesheet.js";
import User from "../models/User.js";
import { flattenTimesheetRows } from "../utils/timesheetEntries.js";
import { startOfWeek, addDays, resolvePresetRange } from "../utils/dateRanges.js";

const requireHr = (req, res) => {
  if (req.user.roles.timesheet !== "hr") {
    res.status(403).json({ message: "HR access required" });
    return false;
  }
  return true;
};

const buildDateFilter = (req) => {
  const filter = {};
  filter.status = req.query.status && req.query.status !== "all" ? req.query.status : { $in: ["submitted", "approved"] };

  const range = req.query.range ? resolvePresetRange(req.query.range) : null;
  if (range) {
    filter.weekStart = { $lte: range.end };
    filter.weekEnd = { $gte: range.start };
  } else {
    if (req.query.startDate) filter.weekEnd = { $gte: new Date(req.query.startDate) };
    if (req.query.endDate) filter.weekStart = { ...(filter.weekStart || {}), $lte: new Date(req.query.endDate) };
  }
  return filter;
};

const fetchEntries = async (filter) => {
  const timesheets = await Timesheet.find(filter)
    .populate("userId", "name email")
    .populate("rows.projectId", "name");
  return flattenTimesheetRows(timesheets);
};

export const getReport = async (req, res) => {
  if (!requireHr(req, res)) return;
  res.json(await fetchEntries(buildDateFilter(req)));
};

export const getUserReport = async (req, res) => {
  if (!requireHr(req, res)) return;
  const filter = { ...buildDateFilter(req), userId: req.params.userId };
  res.json(await fetchEntries(filter));
};

export const getAllUsersSummary = async (req, res) => {
  if (!requireHr(req, res)) return;
  const entries = await fetchEntries(buildDateFilter(req));

  const byUser = new Map();
  for (const e of entries) {
    const cur = byUser.get(e.userId) || { userId: e.userId, userName: e.userName, totalHours: 0 };
    cur.totalHours += e.hours;
    byUser.set(e.userId, cur);
  }
  res.json([...byUser.values()]);
};

export const getProjectSummary = async (req, res) => {
  if (!requireHr(req, res)) return;
  const entries = await fetchEntries(buildDateFilter(req));

  const byProject = new Map();
  for (const e of entries) {
    if (!e.projectId) continue;
    const cur = byProject.get(e.projectId) || { projectId: e.projectId, projectName: e.projectName, totalHours: 0 };
    cur.totalHours += e.hours;
    byProject.set(e.projectId, cur);
  }
  res.json([...byProject.values()]);
};

const sendXlsx = (res, filename, rows) => {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
};

export const exportReport = async (req, res) => {
  if (!requireHr(req, res)) return;
  const entries = await fetchEntries(buildDateFilter(req));
  sendXlsx(
    res,
    "timesheet-report.xlsx",
    entries.map((e) => ({
      Date: e.date.toISOString().slice(0, 10),
      Employee: e.userName,
      Project: e.projectName,
      Hours: e.hours,
      Status: e.status,
    })),
  );
};

export const downloadProjectReport = async (req, res) => {
  if (!requireHr(req, res)) return;
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ message: "projectId is required" });

  const entries = (await fetchEntries(buildDateFilter(req))).filter((e) => e.projectId === projectId);
  sendXlsx(
    res,
    "project-report.xlsx",
    entries.map((e) => ({
      Date: e.date.toISOString().slice(0, 10),
      Employee: e.userName,
      Hours: e.hours,
      Status: e.status,
    })),
  );
};

// Team-wide view of a single week: every active employee's daily hours plus
// whether/how they've submitted, including those with no timesheet at all.
export const getTimesheetStatus = async (req, res) => {
  if (!requireHr(req, res)) return;

  const weekStart = req.query.weekStart ? startOfWeek(new Date(req.query.weekStart)) : startOfWeek(new Date());
  const statusFilter = (req.query.status || "all").split(",").map((s) => s.trim());
  const wantsAll = statusFilter.includes("all");

  const [users, timesheets] = await Promise.all([
    User.find({ "archived.timesheet": false }).select("name email"),
    Timesheet.find({ weekStart }).populate("userId", "name email").populate("rows.projectId", "name"),
  ]);

  const byUserId = new Map(timesheets.map((t) => [String(t.userId?._id || t.userId), t]));

  const rows = users.map((user) => {
    const timesheet = byUserId.get(String(user._id));
    const dayTotals = Array(7).fill(0);
    if (timesheet) {
      for (const row of timesheet.rows) {
        (row.secs || []).forEach((secs, d) => (dayTotals[d] += (secs || 0) / 3600));
      }
    }
    return {
      userId: user._id,
      userName: user.name,
      status: timesheet?.status || "not_submitted",
      dayTotals,
      total: dayTotals.reduce((a, b) => a + b, 0),
    };
  });

  const filtered = wantsAll ? rows : rows.filter((r) => statusFilter.includes(r.status));

  res.json({ weekStart, weekEnd: addDays(weekStart, 6), rows: filtered });
};

const rowHasNsa = (row) => (row.nsa || []).some(Boolean);

const fetchNsaTimesheets = async (req) => {
  const filter = { status: "approved", "rows.nsa": true };
  if (req.query.startDate) filter.weekEnd = { $gte: new Date(req.query.startDate) };
  if (req.query.endDate) filter.weekStart = { ...(filter.weekStart || {}), $lte: new Date(req.query.endDate) };

  const timesheets = await Timesheet.find(filter).populate("userId", "name email").sort({ weekStart: -1 });
  return timesheets.filter((t) => t.rows.some(rowHasNsa));
};

// Approved timesheets containing at least one NSA-flagged day, plus a
// month-over-month distinct-employee trend for the same set.
export const getNsaReport = async (req, res) => {
  if (!requireHr(req, res)) return;

  const timesheets = await fetchNsaTimesheets(req);

  const entries = timesheets.map((t) => ({
    userId: t.userId?._id,
    userName: t.userId?.name,
    weekStart: t.weekStart,
    weekEnd: t.weekEnd,
  }));

  const byMonth = new Map(); // "YYYY-MM" -> Set of userIds
  for (const t of timesheets) {
    const month = t.weekStart.toISOString().slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, new Set());
    byMonth.get(month).add(String(t.userId?._id));
  }
  const trend = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, userIds]) => ({ month, count: userIds.size }));

  res.json({ entries, trend, totalUsers: new Set(entries.map((e) => String(e.userId))).size });
};

const toCsv = (rows) => {
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Name", "Week Start", "Week End"].join(",");
  const lines = rows.map((r) =>
    [escape(r.userName), escape(r.weekStart.toISOString().slice(0, 10)), escape(r.weekEnd.toISOString().slice(0, 10))].join(","),
  );
  return [header, ...lines].join("\n");
};

export const exportNsaReport = async (req, res) => {
  if (!requireHr(req, res)) return;

  const timesheets = await fetchNsaTimesheets(req);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="nsa-report.csv"');
  res.send(toCsv(timesheets));
};

// Date-range-only portion of the filter, shared by every status branch below.
const resolveDateRangeFilter = (req) => {
  const filter = {};
  const range = req.query.range ? resolvePresetRange(req.query.range) : null;
  if (range) {
    filter.weekStart = { $lte: range.end };
    filter.weekEnd = { $gte: range.start };
  } else if (req.query.startDate || req.query.endDate) {
    if (req.query.endDate) filter.weekStart = { $lte: new Date(req.query.endDate) };
    if (req.query.startDate) filter.weekEnd = { ...(filter.weekEnd || {}), $gte: new Date(req.query.startDate) };
  }
  return filter;
};

// Real Timesheet.status values the report's "status" filter can map to
// directly. "all" and "not_submitted" (no submission at all — handled
// separately below) aren't in this enum.
const REAL_STATUSES = ["draft", "submitted", "approved", "rejected", "needs_edit"];

const EMPTY_EMPLOYEE = (u) => ({
  userId: u._id,
  userName: u.name,
  email: u.email,
  totalHours: 0,
  projectCount: 0,
  nsaDays: 0,
  weeksCount: 0,
  avgPerDay: 0,
});

// Per-employee table for the Reports page: hours, distinct projects, an
// 8h/day-implied average, NSA day count and weeks submitted — for every
// active employee, including those with nothing logged in range (0s).
export const getEmployeeReport = async (req, res) => {
  if (!requireHr(req, res)) return;

  const dateFilter = resolveDateRangeFilter(req);
  const users = await User.find({ "archived.timesheet": false }).select("name email");

  // "Not submitted": employees who never moved a timesheet past draft in
  // this range — invert the set of users who *did* submit something.
  if (req.query.status === "not_submitted") {
    const submittedUserIds = new Set(
      (
        await Timesheet.find({ ...dateFilter, status: { $in: ["submitted", "approved", "rejected", "needs_edit"] } }).distinct(
          "userId",
        )
      ).map(String),
    );
    const employees = users.filter((u) => !submittedUserIds.has(String(u._id))).map(EMPTY_EMPLOYEE);
    return res.json({
      employees,
      totals: { totalEmployees: users.length, totalHours: 0, totalProjects: 0, totalNsaDays: 0 },
    });
  }

  const filter = { ...dateFilter };
  if (req.query.status && REAL_STATUSES.includes(req.query.status)) filter.status = req.query.status;

  const timesheets = await Timesheet.find(filter).populate("rows.projectId", "name");

  const byUser = new Map(
    users.map((u) => [
      String(u._id),
      { userId: u._id, userName: u.name, email: u.email, totalHours: 0, projectIds: new Set(), nsaDays: 0, weeksCount: 0 },
    ]),
  );

  const projectIdsInRange = new Set();
  for (const ts of timesheets) {
    const entry = byUser.get(String(ts.userId));
    if (!entry) continue; // archived or otherwise no-longer-listed user
    entry.weeksCount += 1;
    for (const row of ts.rows) {
      const projectId = row.projectId?._id?.toString() || row.projectId?.toString();
      (row.secs || []).forEach((secs, i) => {
        if (secs) {
          entry.totalHours += secs / 3600;
          if (projectId) {
            entry.projectIds.add(projectId);
            projectIdsInRange.add(projectId);
          }
        }
        if (row.nsa?.[i]) entry.nsaDays += 1;
      });
    }
  }

  const employees = [...byUser.values()]
    .map((e) => ({
      userId: e.userId,
      userName: e.userName,
      email: e.email,
      totalHours: Number(e.totalHours.toFixed(2)),
      projectCount: e.projectIds.size,
      nsaDays: e.nsaDays,
      weeksCount: e.weeksCount,
      avgPerDay: e.weeksCount ? Number((e.totalHours / (e.weeksCount * 5)).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.totalHours - a.totalHours);

  res.json({
    employees,
    totals: {
      totalEmployees: users.length,
      totalHours: Number(employees.reduce((sum, e) => sum + e.totalHours, 0).toFixed(2)),
      totalProjects: projectIdsInRange.size,
      totalNsaDays: employees.reduce((sum, e) => sum + e.nsaDays, 0),
    },
  });
};
