import Timesheet from "../models/Timesheet.js";
import User from "../models/User.js";
import { resolvePresetRange } from "../utils/dateRanges.js";
import { flattenTimesheetRows } from "../utils/timesheetEntries.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Flattens submitted/approved timesheet rows into one record per (day, project)
// for dashboard charts — mirrors routes_entries.py's /entries endpoint.
export const getEntries = async (req, res) => {
  const filter = { status: { $in: ["submitted", "approved"] } };
  const isManagerOrHr = ["manager", "hr"].includes(req.user.roles.timesheet);

  if (req.query.userId && isManagerOrHr) {
    // A manager/HR user pulling up one specific person's dashboard — HR can
    // look at anyone, a manager only their own direct report.
    if (req.user.roles.timesheet === "manager") {
      const target = await User.findById(req.query.userId).select("managerId");
      if (!target || String(target.managerId) !== String(req.user._id)) {
        return res.status(403).json({ message: "You can only view your own direct reports" });
      }
    }
    filter.userId = req.query.userId;
  } else if (req.query.view === "self") {
    // `view=self` lets a manager/HR user pull up just their own entries (the
    // reference's toggle); anything else keeps the usual role-based scope —
    // HR sees everyone, a manager sees their team, an employee sees themself.
    filter.userId = req.user._id;
  } else if (req.user.roles.timesheet === "hr") {
    // sees everyone
  } else if (req.user.roles.timesheet === "manager") {
    filter.managerId = req.user._id;
  } else {
    filter.userId = req.user._id;
  }

  const range = resolvePresetRange(req.query.range);
  if (range) {
    filter.weekStart = { $lte: range.end };
    filter.weekEnd = { $gte: range.start };
  } else if (req.query.startDate || req.query.endDate) {
    if (req.query.endDate) filter.weekStart = { $lte: new Date(req.query.endDate) };
    if (req.query.startDate) filter.weekEnd = { ...(filter.weekEnd || {}), $gte: new Date(req.query.startDate) };
  } else {
    // No recognized preset and no explicit dates — bound to the trailing
    // year instead of returning every entry ever logged.
    const end = new Date();
    filter.weekStart = { $lte: end };
    filter.weekEnd = { $gte: new Date(end.getTime() - 365 * DAY_MS) };
  }

  const timesheets = await Timesheet.find(filter)
    .populate("userId", "name email")
    .populate("rows.projectId", "name");

  res.json(flattenTimesheetRows(timesheets));
};
