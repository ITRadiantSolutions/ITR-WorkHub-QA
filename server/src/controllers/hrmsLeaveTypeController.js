import LeaveType from "../models/LeaveType.js";
import { writeAuditLog } from "../utils/activityLog.js";

const FIELDS = ["name", "code", "defaultDaysPerYear", "accrualType", "carryForwardCap"];

const validAccrualType = (value) => value === undefined || ["monthly", "yearly"].includes(value);

export const listLeaveTypes = async (req, res) => {
  const filter = req.query.includeInactive === "true" ? {} : { isActive: true };
  const leaveTypes = await LeaveType.find(filter).sort({ name: 1 });
  res.json(leaveTypes);
};

export const createLeaveType = async (req, res) => {
  if (!req.body.name?.trim()) return res.status(400).json({ message: "name is required" });
  if (!validAccrualType(req.body.accrualType)) {
    return res.status(400).json({ message: "accrualType must be 'monthly' or 'yearly'" });
  }

  const payload = {};
  for (const field of FIELDS) {
    if (req.body[field] !== undefined) payload[field] = req.body[field];
  }

  let leaveType;
  try {
    leaveType = await LeaveType.create({ ...payload, createdBy: req.user._id });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A leave type with this name already exists" });
    throw error;
  }

  writeAuditLog({
    type: "database", event: "hrms.leaveType.created", action: "hrms.leaveType.created",
    actorId: req.user._id, targetId: leaveType._id, oldValue: null, newValue: { name: leaveType.name },
  });
  res.status(201).json(leaveType);
};

export const updateLeaveType = async (req, res) => {
  const leaveType = await LeaveType.findById(req.params.id);
  if (!leaveType) return res.status(404).json({ message: "Leave type not found" });
  if (!validAccrualType(req.body.accrualType)) {
    return res.status(400).json({ message: "accrualType must be 'monthly' or 'yearly'" });
  }

  const oldValue = {};
  const newValue = {};
  for (const field of FIELDS) {
    if (req.body[field] === undefined) continue;
    oldValue[field] = leaveType[field];
    leaveType[field] = req.body[field];
    newValue[field] = req.body[field];
  }

  try {
    await leaveType.save();
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A leave type with this name already exists" });
    throw error;
  }

  writeAuditLog({
    type: "database", event: "hrms.leaveType.updated", action: "hrms.leaveType.updated",
    actorId: req.user._id, targetId: leaveType._id, oldValue, newValue,
  });
  res.json(leaveType);
};

export const setLeaveTypeStatus = async (req, res) => {
  const leaveType = await LeaveType.findById(req.params.id);
  if (!leaveType) return res.status(404).json({ message: "Leave type not found" });

  const oldStatus = leaveType.isActive;
  leaveType.isActive = Boolean(req.body.isActive);
  await leaveType.save();

  writeAuditLog({
    type: "database", event: "hrms.leaveType.statusChanged", action: "hrms.leaveType.statusChanged",
    actorId: req.user._id, targetId: leaveType._id, oldValue: { isActive: oldStatus }, newValue: { isActive: leaveType.isActive },
  });
  res.json(leaveType);
};
