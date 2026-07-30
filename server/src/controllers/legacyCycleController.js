import Cycle from "../models/Cycle.js";

// Serializes our unified (nested) Cycle schema into the flat shape
// ITR_TimeFlow_Production's original PMS/cycles/Cycle.jsx expects, so that
// frontend component can be reused with no changes to its data model.
const toLegacyCycle = (cycle) => ({
  id: cycle._id,
  _id: cycle._id,
  name: cycle.name,
  type: cycle.type,
  start: cycle.start,
  end: cycle.end,
  employeeResponseEnabled: cycle.employeeResponse.enabled,
  employeeResponseExpiry: cycle.employeeResponse.expiry,
  employeeResponseDurationDays: cycle.employeeResponse.durationDays,
  managerResponseEnabled: cycle.managerResponse.enabled,
  managerResponseExpiry: cycle.managerResponse.expiry,
  managerResponseDurationDays: cycle.managerResponse.durationDays,
  reportVisibility: cycle.reportVisibility.mode,
  selectedEmployees: cycle.employeeResponse.selectedUserIds,
  selectedManagers: cycle.managerResponse.selectedUserIds,
  reportVisibleTo: cycle.reportVisibility.visibleTo,
});

const requirePmsHr = (req, res) => {
  if (req.user.roles.pms !== "hr") {
    res.status(403).json({ message: "PMS HR access required" });
    return false;
  }
  return true;
};

export const listCycles = async (req, res) => {
  const cycles = await Cycle.find({}).sort({ start: -1 });
  res.json(cycles.map(toLegacyCycle));
};

export const createCycle = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const { name, type, start, end } = req.body;
  if (!name || !start || !end) {
    return res.status(400).json({ message: "name, start and end are required" });
  }
  const cycle = await Cycle.create({ name, type, start, end, createdBy: req.user._id });
  res.status(201).json(toLegacyCycle(cycle));
};

export const updateCycle = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const { name, type, start, end } = req.body;
  const cycle = await Cycle.findById(req.params.id);
  if (!cycle) return res.status(404).json({ message: "Cycle not found" });

  if (name !== undefined) cycle.name = name;
  if (type !== undefined) cycle.type = type;
  if (start !== undefined) cycle.start = start;
  if (end !== undefined) cycle.end = end;
  await cycle.save();
  res.json(toLegacyCycle(cycle));
};

export const deleteCycle = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const cycle = await Cycle.findByIdAndDelete(req.params.id);
  if (!cycle) return res.status(404).json({ message: "Cycle not found" });
  res.status(204).send();
};

export const toggleResponse = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const { role, enabled, durationDays, extraDays, selectedUsers } = req.body;
  if (!["employee", "manager"].includes(role)) {
    return res.status(400).json({ message: "role must be 'employee' or 'manager'" });
  }

  const cycle = await Cycle.findById(req.params.id);
  if (!cycle) return res.status(404).json({ message: "Cycle not found" });

  const window = cycle[`${role}Response`];
  const wasEnabled = window.enabled;
  window.enabled = Boolean(enabled);

  if (enabled) {
    if (extraDays && wasEnabled && window.expiry) {
      window.expiry = new Date(new Date(window.expiry).getTime() + extraDays * 24 * 60 * 60 * 1000);
    } else if (durationDays) {
      window.durationDays = durationDays;
      window.expiry = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    }
    if (Array.isArray(selectedUsers)) window.selectedUserIds = selectedUsers;
  }

  await cycle.save();
  res.json(toLegacyCycle(cycle));
};

export const updateReportVisibility = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const { reportVisibility, selectedUsers } = req.body;

  const cycle = await Cycle.findById(req.params.id);
  if (!cycle) return res.status(404).json({ message: "Cycle not found" });

  if (reportVisibility !== undefined) cycle.reportVisibility.mode = reportVisibility;
  if (Array.isArray(selectedUsers)) {
    cycle.reportVisibility.visibleToHistory.push(...selectedUsers.map((userId) => ({ userId, changedAt: new Date() })));
    cycle.reportVisibility.visibleTo = selectedUsers;
  }

  await cycle.save();
  res.json(toLegacyCycle(cycle));
};

export const toggleUserReportAccess = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const { userId } = req.body;

  const cycle = await Cycle.findById(req.params.id);
  if (!cycle) return res.status(404).json({ message: "Cycle not found" });

  const idx = cycle.reportVisibility.visibleTo.findIndex((id) => id.toString() === userId);
  if (idx >= 0) cycle.reportVisibility.visibleTo.splice(idx, 1);
  else cycle.reportVisibility.visibleTo.push(userId);
  cycle.reportVisibility.visibleToHistory.push({ userId, changedAt: new Date() });

  await cycle.save();
  res.json(toLegacyCycle(cycle));
};
