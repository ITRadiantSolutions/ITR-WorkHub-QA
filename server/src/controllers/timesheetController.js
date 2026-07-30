import Timesheet from "../models/Timesheet.js";
import User from "../models/User.js";

const isManagerOrHr = (user) => ["manager", "hr"].includes(user.roles.timesheet);

const MAX_SECS_PER_DAY = 8 * 3600;

// Mirrors the client-side rule: no negative hours, and no day (summed across
// every row) over the 8h/day cap. Returns an error message, or null if valid.
const validateRows = (rows) => {
  if (!Array.isArray(rows)) return null;
  const dayTotals = Array(7).fill(0);
  for (const row of rows) {
    for (let d = 0; d < 7; d++) {
      const secs = Number(row.secs?.[d]) || 0;
      if (secs < 0) return "Hours cannot be negative.";
      dayTotals[d] += secs;
    }
  }
  const overCapDay = dayTotals.findIndex((secs) => secs > MAX_SECS_PER_DAY);
  if (overCapDay >= 0) {
    return `Day ${overCapDay + 1} of the week exceeds the 8-hour daily limit (${(dayTotals[overCapDay] / 3600).toFixed(1)}h).`;
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

// Upsert the draft for a given week. Only allowed while status is draft or
// needs_edit — once submitted/approved/rejected, edits must go through resubmit.
export const saveDraft = async (req, res) => {
  const { weekStart, weekEnd, rows, comment } = req.body;
  if (!weekStart || !weekEnd) {
    return res.status(400).json({ message: "weekStart and weekEnd are required" });
  }
  const validationError = validateRows(rows);
  if (validationError) return res.status(400).json({ message: validationError });

  let timesheet = await Timesheet.findOne({ userId: req.user._id, weekStart: new Date(weekStart) });

  if (timesheet && !["draft", "needs_edit"].includes(timesheet.status)) {
    return res.status(409).json({ message: `Cannot edit a timesheet with status '${timesheet.status}'` });
  }

  if (!timesheet) {
    timesheet = new Timesheet({
      userId: req.user._id,
      managerId: req.user.managerId,
      weekStart: new Date(weekStart),
      weekEnd: new Date(weekEnd),
    });
  }

  timesheet.rows = rows || timesheet.rows;
  timesheet.comment = comment ?? timesheet.comment;
  timesheet.status = "draft";
  await timesheet.save();
  res.json(timesheet);
};

export const submitTimesheet = async (req, res) => {
  const timesheet = await Timesheet.findById(req.params.id);
  if (!timesheet) return res.status(404).json({ message: "Timesheet not found" });
  if (!timesheet.userId.equals(req.user._id)) return res.status(403).json({ message: "Forbidden" });
  if (!["draft", "needs_edit"].includes(timesheet.status)) {
    return res.status(409).json({ message: `Cannot submit from status '${timesheet.status}'` });
  }

  timesheet.status = "submitted";
  timesheet.submittedAt = new Date();
  // Let the employee pick a manager per-submission (e.g. no default manager
  // set yet, or routing to someone else); fall back to their profile manager.
  timesheet.managerId = req.body.managerId || req.user.managerId;
  await timesheet.save();
  res.json(timesheet);
};

const MANAGER_ACTIONS = {
  approve: "approved",
  reject: "rejected",
  needs_edit: "needs_edit",
};

export const managerAction = async (req, res) => {
  const nextStatus = MANAGER_ACTIONS[req.params.action];
  if (!nextStatus) return res.status(400).json({ message: "Invalid action" });
  if (!isManagerOrHr(req.user)) return res.status(403).json({ message: "Forbidden" });

  const timesheet = await Timesheet.findById(req.params.id);
  if (!timesheet) return res.status(404).json({ message: "Timesheet not found" });
  if (timesheet.status !== "submitted") {
    return res.status(409).json({ message: `Cannot act on a timesheet with status '${timesheet.status}'` });
  }

  timesheet.status = nextStatus;
  timesheet.managerActionBy = req.user._id;
  timesheet.managerActionAt = new Date();
  await timesheet.save();
  res.json(timesheet);
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
