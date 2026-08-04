import * as XLSX from "xlsx";
import Timesheet from "../models/Timesheet.js";
import User from "../models/User.js";
import Project from "../models/Project.js";
import { flattenTimesheetRows } from "../utils/timesheetEntries.js";
import { startOfWeek, addDays, resolvePresetRange } from "../utils/dateRanges.js";

const requireHr = (req, res) => {
  if (req.user.roles.timesheet !== "hr") {
    res.status(403).json({ message: "HR access required" });
    return false;
  }
  return true;
};

const requireManagerOrHr = (req, res) => {
  if (!["manager", "hr"].includes(req.user.roles.timesheet)) {
    res.status(403).json({ message: "Manager or HR access required" });
    return false;
  }
  return true;
};

// null = no restriction (HR sees everyone); array of userId strings = caller
// only sees these users (a manager's direct reports).
const scopedUserIds = async (req) => {
  if (req.user.roles.timesheet === "hr") return null;
  return (await User.find({ managerId: req.user._id }).distinct("_id")).map(String);
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

// Rich single-employee report: aggregated totals, status breakdown, approval
// rate, per-project hours, and a week-by-week detail table — everything the
// Reports page's employee drill-down needs in one call.
export const getUserReport = async (req, res) => {
  if (!requireManagerOrHr(req, res)) return;

  const employee = await User.findById(req.params.userId).select("name email managerId").populate("managerId", "name");
  if (!employee) return res.status(404).json({ message: "User not found" });
  if (req.user.roles.timesheet === "manager" && String(employee.managerId?._id || employee.managerId) !== String(req.user._id)) {
    return res.status(403).json({ message: "You can only view reports for your direct reports" });
  }

  const dateFilter = resolveDateRangeFilter(req);
  const timesheets = await Timesheet.find({ ...dateFilter, userId: req.params.userId })
    .populate("rows.projectId", "name")
    .sort({ weekStart: 1 });

  const statusCounts = { draft: 0, submitted: 0, approved: 0, rejected: 0, needs_edit: 0 };
  const projectTotals = new Map(); // projectId -> { projectName, hours }
  let totalHours = 0;
  let nsaCount = 0;
  const weeklyDetail = [];

  for (const ts of timesheets) {
    statusCounts[ts.status] = (statusCounts[ts.status] || 0) + 1;
    let weekHours = 0;
    const weekProjects = new Map();

    for (const row of ts.rows) {
      const projectId = row.projectId?._id?.toString() || row.projectId?.toString();
      const projectName = row.projectId?.name || "Unknown";
      (row.secs || []).forEach((secs, i) => {
        const hrs = (secs || 0) / 3600;
        if (hrs > 0) {
          totalHours += hrs;
          weekHours += hrs;
          if (projectId) {
            const totalEntry = projectTotals.get(projectId) || { projectName, hours: 0 };
            totalEntry.hours += hrs;
            projectTotals.set(projectId, totalEntry);

            const weekEntry = weekProjects.get(projectId) || { projectId, projectName, hours: 0 };
            weekEntry.hours += hrs;
            weekProjects.set(projectId, weekEntry);
          }
        }
        if (row.nsa?.[i]) nsaCount += 1;
      });
    }

    weeklyDetail.push({
      weekStart: ts.weekStart,
      weekEnd: ts.weekEnd,
      status: ts.status,
      totalHours: Number(weekHours.toFixed(2)),
      projects: [...weekProjects.values()].map((p) => ({ ...p, hours: Number(p.hours.toFixed(2)) })),
    });
  }

  // Approval rate is judged against weeks that reached a final-ish outcome
  // (approved/rejected/needs_edit) — drafts and still-pending submissions
  // aren't yet decided, so they're excluded from the denominator.
  const decided = statusCounts.approved + statusCounts.rejected + statusCounts.needs_edit;
  const approvalRate = decided ? Number(((statusCounts.approved / decided) * 100).toFixed(1)) : null;

  res.json({
    employee: {
      userId: employee._id,
      userName: employee.name,
      email: employee.email,
      managerName: employee.managerId?.name || null,
    },
    totalHours: Number(totalHours.toFixed(2)),
    totalProjects: projectTotals.size,
    totalWeeks: timesheets.length,
    avgHoursPerDay: timesheets.length ? Number((totalHours / (timesheets.length * 5)).toFixed(2)) : 0,
    nsaCount,
    approvalRate,
    statusCounts,
    projectBreakdown: [...projectTotals.entries()].map(([projectId, v]) => ({
      projectId,
      projectName: v.projectName,
      totalHours: Number(v.hours.toFixed(2)),
    })),
    weeklyTrend: weeklyDetail.map((w) => ({ weekStart: w.weekStart, weekEnd: w.weekEnd, totalHours: w.totalHours })),
    weeklyDetail,
    // Flat per-day rows too, for callers that just want raw entries.
    entries: await fetchEntries({ ...dateFilter, userId: req.params.userId }),
  });
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

// Per-project totals PLUS a per-member breakdown (including assigned team
// members who logged zero hours in range) — who worked on what, not just how much.
export const getProjectSummary = async (req, res) => {
  if (!requireManagerOrHr(req, res)) return;
  const userIds = await scopedUserIds(req);
  const filter = { ...buildDateFilter(req), ...(userIds ? { userId: { $in: userIds } } : {}) };
  const entries = await fetchEntries(filter);
  const projects = await Project.find({}).select("name teamMembers").populate("teamMembers", "name email");

  const byProject = new Map();
  for (const p of projects) {
    const teamMembers = userIds ? (p.teamMembers || []).filter((m) => userIds.includes(String(m._id))) : p.teamMembers || [];
    byProject.set(String(p._id), {
      projectId: String(p._id),
      projectName: p.name,
      totalHours: 0,
      members: new Map(teamMembers.map((m) => [String(m._id), { userId: String(m._id), userName: m.name, email: m.email, hours: 0 }])),
    });
  }

  for (const e of entries) {
    if (!e.projectId) continue;
    const cur = byProject.get(e.projectId) || { projectId: e.projectId, projectName: e.projectName, totalHours: 0, members: new Map() };
    cur.totalHours += e.hours;
    const member = cur.members.get(e.userId) || { userId: e.userId, userName: e.userName, hours: 0 };
    member.hours += e.hours;
    cur.members.set(e.userId, member);
    byProject.set(e.projectId, cur);
  }

  res.json(
    [...byProject.values()]
      .filter((p) => !userIds || p.members.size > 0)
      .map((p) => ({
        projectId: p.projectId,
        projectName: p.projectName,
        totalHours: Number(p.totalHours.toFixed(2)),
        members: [...p.members.values()]
          .map((m) => ({ ...m, hours: Number(m.hours.toFixed(2)) }))
          .sort((a, b) => b.hours - a.hours),
      })),
  );
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
  if (!requireManagerOrHr(req, res)) return;
  const userIds = await scopedUserIds(req);
  const filter = { ...buildDateFilter(req), ...(userIds ? { userId: { $in: userIds } } : {}) };
  const entries = await fetchEntries(filter);
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

// One row per (active) employee who logged time on this project, with a
// Total Hours column plus one column per week worked (a pivot), instead of a
// flat per-entry dump — matches the reference report's shape.
export const downloadProjectReport = async (req, res) => {
  if (!requireManagerOrHr(req, res)) return;
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ message: "projectId is required" });

  const scoped = await scopedUserIds(req);
  const filter = { ...buildDateFilter(req), ...(scoped ? { userId: { $in: scoped } } : {}) };
  const [timesheets, activeUserIds] = await Promise.all([
    Timesheet.find(filter).populate("userId", "name email").populate("rows.projectId", "name"),
    User.find({ "archived.timesheet": false }).distinct("_id").then((ids) => new Set(ids.map(String))),
  ]);

  const weeksSet = new Set();
  const byUser = new Map(); // userId -> { name, email, totalHours, weeks: Map(weekKey -> hours) }

  for (const ts of timesheets) {
    const userId = String(ts.userId?._id || ts.userId);
    if (!activeUserIds.has(userId)) continue;

    let weekHours = 0;
    for (const row of ts.rows) {
      const pid = row.projectId?._id?.toString() || row.projectId?.toString();
      if (pid !== projectId) continue;
      weekHours += (row.secs || []).reduce((sum, s) => sum + (s || 0), 0) / 3600;
    }
    if (weekHours <= 0) continue;

    const weekKey = ts.weekStart.toISOString().slice(0, 10);
    weeksSet.add(weekKey);
    const entry = byUser.get(userId) || { name: ts.userId?.name, email: ts.userId?.email, totalHours: 0, weeks: new Map() };
    entry.totalHours += weekHours;
    entry.weeks.set(weekKey, (entry.weeks.get(weekKey) || 0) + weekHours);
    byUser.set(userId, entry);
  }

  const weekCols = [...weeksSet].sort();
  const rows = [
    ["Employee", "Email", "Total Hours", ...weekCols],
    ...[...byUser.values()].map((e) => [
      e.name,
      e.email,
      Number(e.totalHours.toFixed(2)),
      ...weekCols.map((w) => (e.weeks.has(w) ? Number(e.weeks.get(w).toFixed(2)) : "")),
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 12 }, ...weekCols.map(() => ({ wch: 12 }))];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Project Report");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="project-report.xlsx"');
  res.send(buffer);
};

// Team-wide status grid: every visible employee × every week in the chosen
// range, including employees with no timesheet at all that week. HR sees
// everyone active; a manager only sees their own direct reports. Pass
// `range` (this_week/last_week/this_month/last_month/last_6_months) for a
// multi-week grid, or `weekStart` (or nothing, defaulting to the current
// week) for the classic single-week snapshot.
export const getTimesheetStatus = async (req, res) => {
  if (!requireManagerOrHr(req, res)) return;

  const isHr = req.user.roles.timesheet === "hr";
  const statusFilter = (req.query.status || "all").split(",").map((s) => s.trim());
  const wantsAll = statusFilter.includes("all");

  let weekStarts;
  const range = req.query.range ? resolvePresetRange(req.query.range) : null;
  const customRange =
    !range && req.query.startDate && req.query.endDate
      ? { start: new Date(req.query.startDate), end: new Date(req.query.endDate) }
      : null;
  const effectiveRange = range || customRange;
  if (effectiveRange) {
    // Custom ranges are clamped server-side too — never trust the client to
    // enforce "no future dates, max 6 months" on its own.
    const now = new Date();
    const end = effectiveRange.end > now ? now : effectiveRange.end;
    const minStart = new Date(end);
    minStart.setMonth(minStart.getMonth() - 6);
    const start = effectiveRange.start < minStart ? minStart : effectiveRange.start;

    weekStarts = [];
    let cursor = startOfWeek(start);
    const last = startOfWeek(end);
    while (cursor <= last) {
      weekStarts.push(new Date(cursor));
      cursor = addDays(cursor, 7);
    }
  } else {
    weekStarts = [req.query.weekStart ? startOfWeek(new Date(req.query.weekStart)) : startOfWeek(new Date())];
  }

  const userFilter = { "archived.timesheet": false };
  if (!isHr) userFilter.managerId = req.user._id;
  if (req.query.userId) userFilter._id = req.query.userId;

  const [users, timesheets] = await Promise.all([
    User.find(userFilter).select("name email"),
    Timesheet.find({ weekStart: { $in: weekStarts } }).select("userId weekStart status rows"),
  ]);

  const byUserWeek = new Map();
  for (const t of timesheets) byUserWeek.set(`${String(t.userId)}_${t.weekStart.toISOString()}`, t);

  const rows = users
    .map((user) => {
      const weeks = {};
      let matchesFilter = wantsAll;
      for (const weekStart of weekStarts) {
        const ts = byUserWeek.get(`${String(user._id)}_${weekStart.toISOString()}`);
        const dayTotals = Array(7).fill(0);
        if (ts) {
          for (const row of ts.rows) {
            (row.secs || []).forEach((secs, d) => (dayTotals[d] += (secs || 0) / 3600));
          }
        }
        const status = ts?.status || "not_submitted";
        if (!wantsAll && statusFilter.includes(status)) matchesFilter = true;
        weeks[weekStart.toISOString().slice(0, 10)] = { status, dayTotals, total: dayTotals.reduce((a, b) => a + b, 0) };
      }
      return { userId: user._id, userName: user.name, weeks, matchesFilter };
    })
    .filter((r) => r.matchesFilter)
    .map(({ matchesFilter, ...r }) => r);

  res.json({ weeks: weekStarts.map((w) => ({ weekStart: w, weekEnd: addDays(w, 6) })), rows });
};

const rowHasNsa = (row) => (row.nsa || []).some(Boolean);

const fetchNsaTimesheets = async (req) => {
  const filter = { status: "approved", "rows.nsa": true };
  if (req.query.startDate) filter.weekEnd = { $gte: new Date(req.query.startDate) };
  if (req.query.endDate) filter.weekStart = { ...(filter.weekStart || {}), $lte: new Date(req.query.endDate) };

  const timesheets = await Timesheet.find(filter)
    .populate("userId", "name email")
    .populate("managerActionBy", "name")
    .sort({ weekStart: -1 });
  return timesheets.filter((t) => t.rows.some(rowHasNsa));
};

// Mon-Fri booleans: true if ANY row on the timesheet flagged NSA that day.
const nsaDaysForWeek = (timesheet) => {
  const days = Array(5).fill(false);
  for (const row of timesheet.rows) {
    (row.nsa || []).forEach((flag, i) => {
      if (flag && i < 5) days[i] = true;
    });
  }
  return days;
};

// Mon-Fri hours: seconds logged on cells flagged NSA that day, summed across rows.
const nsaHoursForWeek = (timesheet) => {
  const secs = Array(5).fill(0);
  for (const row of timesheet.rows) {
    (row.nsa || []).forEach((flag, i) => {
      if (flag && i < 5) secs[i] += row.secs?.[i] || 0;
    });
  }
  return secs.map((s) => s / 3600);
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
    days: nsaDaysForWeek(t),
    hours: nsaHoursForWeek(t),
    approver: t.managerActionBy?.name || null,
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

const toCsv = (timesheets) => {
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Name", "Mon", "Tue", "Wed", "Thu", "Fri", "Week Start", "Week End", "Approver"].join(",");
  const lines = timesheets.map((t) => {
    const days = nsaDaysForWeek(t);
    const hours = nsaHoursForWeek(t);
    return [
      escape(t.userId?.name),
      ...days.map((d, i) => escape(d ? `Yes (${hours[i].toFixed(1)}h)` : "No")),
      escape(t.weekStart.toISOString().slice(0, 10)),
      escape(t.weekEnd.toISOString().slice(0, 10)),
      escape(t.managerActionBy?.name || ""),
    ].join(",");
  });
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
  managerName: u.managerId?.name || null,
  totalHours: 0,
  projectCount: 0,
  nsaDays: 0,
  weeksCount: 0,
  avgPerDay: 0,
  approvalRate: null,
});

// Per-employee table for the Reports page: hours, distinct projects, an
// 8h/day-implied average, NSA day count and weeks submitted — for every
// active employee, including those with nothing logged in range (0s).
export const getEmployeeReport = async (req, res) => {
  if (!requireManagerOrHr(req, res)) return;

  const dateFilter = resolveDateRangeFilter(req);
  const userFilter = { "archived.timesheet": false };
  if (req.user.roles.timesheet === "manager") userFilter.managerId = req.user._id;
  const users = await User.find(userFilter).select("name email managerId").populate("managerId", "name");

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
      {
        userId: u._id,
        userName: u.name,
        email: u.email,
        managerName: u.managerId?.name || null,
        totalHours: 0,
        projectIds: new Set(),
        nsaDays: 0,
        weeksCount: 0,
        statusCounts: { approved: 0, rejected: 0, needs_edit: 0 },
      },
    ]),
  );

  const projectIdsInRange = new Set();
  for (const ts of timesheets) {
    const entry = byUser.get(String(ts.userId));
    if (!entry) continue; // archived or otherwise no-longer-listed user
    entry.weeksCount += 1;
    if (entry.statusCounts[ts.status] !== undefined) entry.statusCounts[ts.status] += 1;
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
    .map((e) => {
      const decided = e.statusCounts.approved + e.statusCounts.rejected + e.statusCounts.needs_edit;
      return {
        userId: e.userId,
        userName: e.userName,
        email: e.email,
        managerName: e.managerName,
        totalHours: Number(e.totalHours.toFixed(2)),
        projectCount: e.projectIds.size,
        nsaDays: e.nsaDays,
        weeksCount: e.weeksCount,
        avgPerDay: e.weeksCount ? Number((e.totalHours / (e.weeksCount * 5)).toFixed(2)) : 0,
        approvalRate: decided ? Number(((e.statusCounts.approved / decided) * 100).toFixed(1)) : null,
      };
    })
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
