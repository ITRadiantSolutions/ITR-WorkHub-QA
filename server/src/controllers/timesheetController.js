import mongoose from "mongoose";
import Timesheet from "../models/Timesheet.js";
import User from "../models/User.js";
import Project from "../models/Project.js";
import CompanyHoliday from "../models/CompanyHoliday.js";
import { sendMail } from "../utils/graphMailer.js";

const fmtDate = (date) => date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const ACTION_LABEL = { rejected: "rejected", needs_edit: "sent back for edits" };

const escapeHtml = (str) =>
  String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const managerActionEmailBody = (employeeName, weekStart, weekEnd, actionLabel, comment) => `
<html><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px;">
<table width="100%" cellpadding="0" cellspacing="0" style="border-left:4px solid #dc2626;padding-left:16px;">
<tr><td style="font-size:14px;color:#111827;">
<p>Hi <strong>${escapeHtml(employeeName)}</strong>,</p>
<p>Your timesheet for <strong>${fmtDate(weekStart)} to ${fmtDate(weekEnd)}</strong> has been <strong>${actionLabel}</strong> by your manager.</p>
${comment ? `<p style="margin:10px 0;padding:10px;background:#f3f4f6;border-radius:6px;"><strong>Comment:</strong> ${escapeHtml(comment)}</p>` : ""}
<p>Please review and resubmit as needed.</p>
</td></tr></table>
<p style="margin-top:16px;font-weight:600;color:#2563eb;">TimeFlow</p>
</td></tr></table></body></html>`;

const isManagerOrHr = (user) => ["manager", "hr"].includes(user.roles.timesheet);

const MAX_SECS_PER_DAY = 8 * 3600;
const MAX_SECS_PER_WEEK = 40 * 3600;

const pad2 = (n) => String(n).padStart(2, "0");
const fmtISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};
const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // days since Monday
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d;
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id ?? ""));

// Mirrors the client-side rules, plus server-side-only rules that have no UI
// equivalent to bypass: every row's projectId must be a real project the
// submitting user actually belongs to, secs/nsa must each be exactly 7
// entries, no negative hours, no day over the 8h/day cap, no week over the
// 40h/week cap, no hours (or NSA) on Sat/Sun or a project's declared holiday,
// NSA must be backed by actual hours that day, and NSA can't be claimed for a
// future date. Returns an error message, or null if valid.
const validateRows = async (rows, weekStart, user) => {
  if (!Array.isArray(rows)) return null;

  for (const row of rows) {
    if (!isValidObjectId(row.projectId)) {
      return "Each row must reference a valid project.";
    }
    if (!Array.isArray(row.secs) || row.secs.length !== 7) {
      return "Hours must be provided for all 7 days.";
    }
    if (!Array.isArray(row.nsa) || row.nsa.length !== 7) {
      return "NSA values must be provided for all 7 days.";
    }
    if (row.nsa.some((v) => typeof v !== "boolean")) {
      return "NSA values must be true or false.";
    }
  }

  const dayTotals = Array(7).fill(0);
  let weekTotal = 0;
  for (const row of rows) {
    for (let d = 0; d < 7; d++) {
      const secs = Number(row.secs?.[d]) || 0;
      if (secs < 0) return "Hours cannot be negative.";
      dayTotals[d] += secs;
      weekTotal += secs;
    }
  }

  const overCapDay = dayTotals.findIndex((secs) => secs > MAX_SECS_PER_DAY);
  if (overCapDay >= 0) {
    return `Day ${overCapDay + 1} of the week exceeds the 8-hour daily limit (${(dayTotals[overCapDay] / 3600).toFixed(1)}h).`;
  }
  if (weekTotal > MAX_SECS_PER_WEEK) {
    return `Weekly total exceeds the 40-hour weekly limit (${(weekTotal / 3600).toFixed(1)}h).`;
  }
  if (dayTotals[5] > 0 || dayTotals[6] > 0) {
    return "Saturday and Sunday cannot have logged hours.";
  }
  if (rows.some((row) => row.nsa?.[5] || row.nsa?.[6])) {
    return "NSA cannot be claimed for Saturday or Sunday.";
  }
  if (rows.some((row) => row.nsa?.some((claimed, d) => claimed && !(Number(row.secs?.[d]) > 0)))) {
    return "NSA cannot be claimed on a day with no hours logged.";
  }

  const projectIds = [...new Set(rows.map((r) => String(r.projectId)))];
  const projects = await Project.find({ _id: { $in: projectIds } }, "holidays excludedHolidays teamMembers projectLead createdBy");
  const projectsById = new Map(projects.map((p) => [String(p._id), p]));

  const isAdmin = user?.roles?.tracker === "ADMIN";
  const isHr = user?.roles?.timesheet === "hr";
  for (const id of projectIds) {
    const project = projectsById.get(id);
    if (!project) return "One or more selected projects could not be found.";
    if (isAdmin || isHr) continue;
    const isMember =
      project.teamMembers?.some((m) => String(m) === String(user._id)) ||
      String(project.projectLead || "") === String(user._id) ||
      String(project.createdBy || "") === String(user._id);
    if (!isMember) return "You are not assigned to one of the selected projects.";
  }

  if (weekStart) {
    // Effective locked dates per project = (company-wide calendar + this
    // project's own extra holidays) minus any dates this project has
    // specifically opted out of (e.g. a client who works through it).
    const companyHolidays = await CompanyHoliday.find({}, "date");
    const companyHolidaySet = new Set(companyHolidays.map((h) => h.date));
    const holidaysByProject = new Map(
      projects.map((p) => {
        const excluded = new Set(p.excludedHolidays || []);
        const effective = new Set([...companyHolidaySet, ...(p.holidays || [])].filter((d) => !excluded.has(d)));
        return [String(p._id), effective];
      }),
    );
    const todayStr = fmtISODate(new Date());
    for (const row of rows) {
      const holidays = holidaysByProject.get(String(row.projectId));
      for (let d = 0; d < 5; d++) {
        const secs = Number(row.secs?.[d]) || 0;
        const claimed = Boolean(row.nsa?.[d]);
        if (secs <= 0 && !claimed) continue;

        const dateStr = fmtISODate(addDays(new Date(weekStart), d));
        if (secs > 0 && holidays?.has(dateStr)) {
          return `${dateStr} is a declared holiday and cannot have logged hours.`;
        }
        if (claimed && holidays?.has(dateStr)) {
          return `${dateStr} is a declared holiday and cannot have an NSA claim.`;
        }
        if (claimed && dateStr > todayStr) {
          return `${dateStr} is a future date and cannot have an NSA claim.`;
        }
      }
    }
  }

  return null;
};

const canView = (timesheet, user) =>
  timesheet.userId.equals(user._id) ||
  (timesheet.managerId && timesheet.managerId.equals(user._id)) ||
  user.roles.timesheet === "hr";

export const listMyTimesheets = async (req, res) => {
  const timesheets = await Timesheet.find({ userId: req.user._id })
    .populate("rows.projectId", "name")
    .populate("managerActionBy", "name")
    .sort({ weekStart: -1 });
  res.json(timesheets);
};

export const getTimesheet = async (req, res) => {
  const timesheet = await Timesheet.findById(req.params.id).populate("rows.projectId", "name");
  if (!timesheet) return res.status(404).json({ message: "Timesheet not found" });
  if (!canView(timesheet, req.user)) return res.status(403).json({ message: "Forbidden" });
  res.json(timesheet);
};

// Statuses the employee is allowed to edit/resubmit from — includes
// "rejected" so a rejected week isn't a dead end; the employee can fix it
// and submit again rather than losing the week entirely.
const EDITABLE_STATUSES = ["draft", "needs_edit", "rejected"];

// Upsert the draft for a given week. Only allowed from an editable status —
// once submitted/approved, edits must go through resubmit.
export const saveDraft = async (req, res) => {
  const { weekStart: rawWeekStart, weekEnd, rows, comment } = req.body;
  if (!rawWeekStart || !weekEnd) {
    return res.status(400).json({ message: "weekStart and weekEnd are required" });
  }
  const parsedWeekStart = new Date(rawWeekStart);
  if (Number.isNaN(parsedWeekStart.getTime())) {
    return res.status(400).json({ message: "weekStart is not a valid date" });
  }
  // Always anchor to the real Monday of that week and derive weekEnd from it
  // — never trust a client-supplied weekEnd, since every day-of-week rule
  // (weekend lock, holiday lookup) is computed as offsets from weekStart.
  const weekStart = startOfWeek(parsedWeekStart);
  const weekEndDate = addDays(weekStart, 6);

  const validationError = await validateRows(rows, weekStart, req.user);
  if (validationError) return res.status(400).json({ message: validationError });

  let timesheet = await Timesheet.findOne({ userId: req.user._id, weekStart });

  if (timesheet && !EDITABLE_STATUSES.includes(timesheet.status)) {
    return res.status(409).json({ message: `Cannot edit a timesheet with status '${timesheet.status}'` });
  }

  if (!timesheet) {
    timesheet = new Timesheet({
      userId: req.user._id,
      managerId: req.user.managerId,
      weekStart,
      weekEnd: weekEndDate,
    });
  }

  timesheet.rows = rows || timesheet.rows;
  timesheet.comment = comment ?? timesheet.comment;
  timesheet.status = "draft";
  try {
    await timesheet.save();
  } catch (err) {
    // Two concurrent saves (double-click, two tabs) for the same user+week both
    // pass the findOne above as "new" and race to create — the loser hits the
    // unique index instead of crashing with a raw Mongo error.
    if (err.code === 11000) {
      return res.status(409).json({ message: "This week was just saved elsewhere — please refresh and try again." });
    }
    throw err;
  }
  res.json(timesheet);
};

export const submitTimesheet = async (req, res) => {
  const timesheet = await Timesheet.findById(req.params.id);
  if (!timesheet) return res.status(404).json({ message: "Timesheet not found" });
  if (!timesheet.userId.equals(req.user._id)) return res.status(403).json({ message: "Forbidden" });
  if (!EDITABLE_STATUSES.includes(timesheet.status)) {
    return res.status(409).json({ message: `Cannot submit from status '${timesheet.status}'` });
  }

  // Defense in depth: re-run the same checks saveDraft applies, in case this
  // timesheet's rows became invalid since it was last saved (e.g. a holiday
  // was declared afterwards) or /submit is called without a prior /save.
  const validationError = await validateRows(timesheet.rows, timesheet.weekStart, req.user);
  if (validationError) return res.status(400).json({ message: validationError });

  // Let the employee pick a manager per-submission (e.g. no default manager
  // set yet, or routing to someone else); fall back to their profile manager.
  // Either way, the chosen id must actually belong to a manager/HR user —
  // don't let the client route a submission to an arbitrary user, and don't
  // let anyone (e.g. a "manager"-role employee) approve their own submission.
  const managerId = req.body.managerId || req.user.managerId;
  if (!managerId) return res.status(400).json({ message: "A manager is required before submitting" });
  if (String(managerId) === String(req.user._id)) {
    return res.status(400).json({ message: "You cannot submit a timesheet to yourself for approval" });
  }
  const manager = await User.findById(managerId).select("roles");
  if (!manager || !["manager", "hr"].includes(manager.roles?.timesheet)) {
    return res.status(400).json({ message: "Selected manager is not a valid manager" });
  }

  const resubmitted = ["rejected", "needs_edit"].includes(timesheet.status);
  timesheet.status = "submitted";
  timesheet.submittedAt = new Date();
  timesheet.managerId = managerId;
  timesheet.history.push({
    action: "submitted",
    by: req.user._id,
    at: timesheet.submittedAt,
    comment: resubmitted ? "Resubmitted after " + (timesheet.history.at(-1)?.action || "edit") : "",
  });
  await timesheet.save();
  res.json(timesheet);
};

const MANAGER_ACTIONS = {
  approve: "approved",
  reject: "rejected",
  needs_edit: "needs_edit",
};

// Shared by the single and bulk action endpoints: applies the status
// transition + history entry, and best-effort emails the employee. Returns
// null on success, or an { status, message } error descriptor.
const applyManagerAction = async (timesheet, nextStatus, actor, comment) => {
  const isAssignedManager = timesheet.managerId && timesheet.managerId.equals(actor._id);
  const isHr = actor.roles.timesheet === "hr";
  if (!isAssignedManager && !isHr) {
    return { status: 403, message: "You are not the assigned manager for this timesheet" };
  }
  if (timesheet.status !== "submitted") {
    return { status: 409, message: `Cannot act on a timesheet with status '${timesheet.status}'` };
  }

  timesheet.status = nextStatus;
  timesheet.managerActionBy = actor._id;
  timesheet.managerActionAt = new Date();
  timesheet.managerComment = comment || "";
  timesheet.history.push({ action: nextStatus, by: actor._id, at: timesheet.managerActionAt, comment: timesheet.managerComment });
  await timesheet.save();

  const actionLabel = ACTION_LABEL[nextStatus];
  if (actionLabel && timesheet.userId?.email) {
    try {
      await sendMail(
        timesheet.userId.email,
        `Your timesheet was ${actionLabel}`,
        managerActionEmailBody(timesheet.userId.name, timesheet.weekStart, timesheet.weekEnd, actionLabel, timesheet.managerComment),
      );
    } catch (err) {
      // Don't fail the approval action just because the notification email couldn't be sent.
      console.error("applyManagerAction: failed to send notification email", err.message);
    }
  }
  return null;
};

export const managerAction = async (req, res) => {
  const nextStatus = MANAGER_ACTIONS[req.params.action];
  if (!nextStatus) return res.status(400).json({ message: "Invalid action" });
  if (!isManagerOrHr(req.user)) return res.status(403).json({ message: "Forbidden" });

  const timesheet = await Timesheet.findById(req.params.id).populate("userId", "name email");
  if (!timesheet) return res.status(404).json({ message: "Timesheet not found" });

  const error = await applyManagerAction(timesheet, nextStatus, req.user, req.body.comment);
  if (error) return res.status(error.status).json({ message: error.message });

  res.json(timesheet);
};

// Bulk approve/reject/needs_edit — one request instead of N, and reports
// per-item results instead of failing the whole batch if some items aren't
// this manager's to act on (or are no longer in "submitted").
export const bulkManagerAction = async (req, res) => {
  const nextStatus = MANAGER_ACTIONS[req.body.action];
  if (!nextStatus) return res.status(400).json({ message: "Invalid action" });
  if (!isManagerOrHr(req.user)) return res.status(403).json({ message: "Forbidden" });

  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ message: "ids must be a non-empty array" });

  const timesheets = await Timesheet.find({ _id: { $in: ids } }).populate("userId", "name email");
  const foundIds = new Set(timesheets.map((t) => String(t._id)));

  const results = [];
  for (const id of ids) {
    if (!foundIds.has(String(id))) {
      results.push({ id, ok: false, message: "Timesheet not found" });
    }
  }
  for (const timesheet of timesheets) {
    const error = await applyManagerAction(timesheet, nextStatus, req.user, req.body.comment);
    results.push(error ? { id: timesheet._id, ok: false, message: error.message } : { id: timesheet._id, ok: true });
  }

  res.json({ results });
};

export const clearWeek = async (req, res) => {
  const timesheet = await Timesheet.findOne({
    userId: req.user._id,
    weekStart: new Date(req.params.weekStart),
  });
  if (!timesheet) return res.status(404).json({ message: "Timesheet not found" });
  if (timesheet.status !== "draft") {
    return res.status(409).json({ message: "Only a draft timesheet can be cleared" });
  }
  await timesheet.deleteOne();
  res.status(204).send();
};

export const managerTimesheets = async (req, res) => {
  if (!isManagerOrHr(req.user)) return res.status(403).json({ message: "Forbidden" });

  const filter = req.user.roles.timesheet === "hr" ? {} : { managerId: req.user._id };
  if (req.query.status) filter.status = req.query.status;

  const timesheets = await Timesheet.find(filter)
    .populate("userId", "name email")
    .populate("rows.projectId", "name")
    .sort({ submittedAt: -1 });
  res.json(timesheets);
};

export const managerTimesheetById = async (req, res) => {
  if (!isManagerOrHr(req.user)) return res.status(403).json({ message: "Forbidden" });

  const timesheet = await Timesheet.findById(req.params.id)
    .populate("userId", "name email")
    .populate("rows.projectId", "name");
  if (!timesheet) return res.status(404).json({ message: "Timesheet not found" });
  if (!canView(timesheet, req.user)) return res.status(403).json({ message: "Forbidden" });
  res.json(timesheet);
};

export const managerTimesheetStatus = async (req, res) => {
  if (!isManagerOrHr(req.user)) return res.status(403).json({ message: "Forbidden" });

  const filter = req.user.roles.timesheet === "hr" ? {} : { managerId: req.user._id };
  const counts = await Timesheet.aggregate([
    { $match: filter },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  res.json(Object.fromEntries(counts.map((c) => [c._id, c.count])));
};

// Exposed for entries/HR-report controllers that need a manager's report list.
export const getReportUserIds = async (managerId) => {
  const reports = await User.find({ managerId }).select("_id");
  return reports.map((u) => u._id);
};
