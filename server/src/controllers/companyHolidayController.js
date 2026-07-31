import CompanyHoliday from "../models/CompanyHoliday.js";

const requireHr = (req, res) => {
  if (req.user.roles.timesheet !== "hr") {
    res.status(403).json({ message: "HR access required" });
    return false;
  }
  return true;
};

// Readable by anyone authenticated — every employee's timesheet needs this
// list to know which days are locked by default.
export const listCompanyHolidays = async (req, res) => {
  const holidays = await CompanyHoliday.find().sort({ date: 1 });
  res.json(holidays);
};

export const addCompanyHoliday = async (req, res) => {
  if (!requireHr(req, res)) return;
  const { date, label } = req.body;
  if (!date || Number.isNaN(new Date(date).getTime())) {
    return res.status(400).json({ message: "A valid date is required" });
  }
  try {
    const holiday = await CompanyHoliday.findOneAndUpdate(
      { date },
      { date, label: label || "", createdBy: req.user._id },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    res.status(201).json(holiday);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "That date is already a company holiday" });
    throw err;
  }
};

export const removeCompanyHoliday = async (req, res) => {
  if (!requireHr(req, res)) return;
  await CompanyHoliday.deleteOne({ date: req.params.date });
  res.status(204).send();
};
