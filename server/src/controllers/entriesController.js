import Timesheet from "../models/Timesheet.js";
import { resolvePresetRange } from "../utils/dateRanges.js";
import { flattenTimesheetRows } from "../utils/timesheetEntries.js";

// Flattens submitted/approved timesheet rows into one record per (day, project)
// for dashboard charts — mirrors routes_entries.py's /entries endpoint.
export const getEntries = async (req, res) => {
  const filter = { status: { $in: ["submitted", "approved"] } };

  if (req.user.roles.timesheet === "hr") {
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
  }

  const timesheets = await Timesheet.find(filter)
    .populate("userId", "name email")
    .populate("rows.projectId", "name");

  res.json(flattenTimesheetRows(timesheets));
};
