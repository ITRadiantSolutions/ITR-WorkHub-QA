import CompanyHoliday from "../models/CompanyHoliday.js";
import { writeAuditLog } from "../utils/activityLog.js";

// Same CompanyHoliday collection TimeFlow's timesheet module reads (the
// calendar is intentionally shared, not duplicated — see companyHolidayController.js)
// — this just exposes it under HRMS's own hrms:"hr" gate instead of
// timesheet:"hr", since an HRMS HR user won't necessarily hold the
// timesheet-module HR role too.
export const listHolidays = async (req, res) => {
  const year = /^\d{4}$/.test(req.query.year) ? req.query.year : String(new Date().getFullYear());
  const holidays = await CompanyHoliday.find({ date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } }).sort({ date: 1 });
  res.json(holidays);
};

export const addHoliday = async (req, res) => {
  const { date, label, isFloater } = req.body;
  if (!date || Number.isNaN(new Date(date).getTime())) {
    return res.status(400).json({ message: "A valid date is required" });
  }

  let holiday;
  try {
    holiday = await CompanyHoliday.findOneAndUpdate(
      { date },
      { date, label: label || "", isFloater: Boolean(isFloater), createdBy: req.user._id },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "That date is already a company holiday" });
    throw err;
  }

  writeAuditLog({
    type: "database", event: "hrms.holiday.added", action: "hrms.holiday.added",
    actorId: req.user._id, targetId: holiday._id, oldValue: null, newValue: { date: holiday.date, label: holiday.label },
  });
  res.status(201).json(holiday);
};

export const removeHoliday = async (req, res) => {
  const holiday = await CompanyHoliday.findOneAndDelete({ date: req.params.date });
  if (!holiday) return res.status(404).json({ message: "Holiday not found" });

  writeAuditLog({
    type: "database", event: "hrms.holiday.removed", action: "hrms.holiday.removed",
    actorId: req.user._id, targetId: holiday._id, oldValue: { date: holiday.date, label: holiday.label }, newValue: null,
  });
  res.status(204).send();
};
