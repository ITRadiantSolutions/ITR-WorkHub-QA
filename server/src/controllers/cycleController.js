import Cycle from "../models/Cycle.js";

const requirePmsHr = (req, res) => {
  if (req.user.roles.pms !== "hr") {
    res.status(403).json({ message: "PMS HR access required" });
    return false;
  }
  return true;
};

export const listCycles = async (req, res) => {
  const cycles = await Cycle.find({}).sort({ start: -1 });
  res.json(cycles);
};

export const getCycle = async (req, res) => {
  const cycle = await Cycle.findById(req.params.id);
  if (!cycle) return res.status(404).json({ message: "Cycle not found" });
  res.json(cycle);
};

export const createCycle = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const { name, type, start, end } = req.body;
  if (!name || !start || !end) {
    return res.status(400).json({ message: "name, start and end are required" });
  }
  const cycle = await Cycle.create({ name, type, start, end, createdBy: req.user._id });
  res.status(201).json(cycle);
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
  res.json(cycle);
};

export const deleteCycle = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const cycle = await Cycle.findByIdAndDelete(req.params.id);
  if (!cycle) return res.status(404).json({ message: "Cycle not found" });
  res.status(204).send();
};

const setResponseWindow = (field) => async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const { enabled, expiry, durationDays, selectedUserIds } = req.body;

  const cycle = await Cycle.findById(req.params.id);
  if (!cycle) return res.status(404).json({ message: "Cycle not found" });

  if (enabled !== undefined) cycle[field].enabled = enabled;
  if (expiry !== undefined) cycle[field].expiry = expiry;
  if (durationDays !== undefined) cycle[field].durationDays = durationDays;
  if (selectedUserIds !== undefined) cycle[field].selectedUserIds = selectedUserIds;

  await cycle.save();
  res.json(cycle);
};

export const setEmployeeResponseWindow = setResponseWindow("employeeResponse");
export const setManagerResponseWindow = setResponseWindow("managerResponse");

export const setReportVisibility = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const { mode, visibleTo } = req.body;

  const cycle = await Cycle.findById(req.params.id);
  if (!cycle) return res.status(404).json({ message: "Cycle not found" });

  if (mode !== undefined) cycle.reportVisibility.mode = mode;
  if (visibleTo !== undefined) {
    cycle.reportVisibility.visibleToHistory.push(
      ...visibleTo.map((userId) => ({ userId, changedAt: new Date() })),
    );
    cycle.reportVisibility.visibleTo = visibleTo;
  }

  await cycle.save();
  res.json(cycle);
};

// Shared with the daily expiry-cleanup cron job.
export const disableExpiredCycles = async () => {
  const now = new Date();
  const result = await Cycle.updateMany(
    {
      $or: [
        { "employeeResponse.enabled": true, "employeeResponse.expiry": { $lt: now } },
        { "managerResponse.enabled": true, "managerResponse.expiry": { $lt: now } },
      ],
    },
    [
      {
        $set: {
          "employeeResponse.enabled": {
            $cond: [{ $lt: ["$employeeResponse.expiry", now] }, false, "$employeeResponse.enabled"],
          },
          "managerResponse.enabled": {
            $cond: [{ $lt: ["$managerResponse.expiry", now] }, false, "$managerResponse.enabled"],
          },
        },
      },
    ],
  );
  return { matched: result.matchedCount, modified: result.modifiedCount };
};
