import Designation from "../models/Designation.js";
import { writeAuditLog } from "../utils/activityLog.js";

const FIELDS = ["name", "department", "level"];

// The client's "no department" option submits "" — Mongoose can't cast that
// to ObjectId, so normalize it to null before it ever reaches the schema.
const cleanPayload = (body) => {
  const payload = {};
  for (const field of FIELDS) {
    if (body[field] === undefined) continue;
    payload[field] = field === "department" && body[field] === "" ? null : body[field];
  }
  return payload;
};

export const listDesignations = async (req, res) => {
  const filter = req.query.includeInactive === "true" ? {} : { isActive: true };
  if (req.query.department?.trim()) filter.department = req.query.department.trim();

  const designations = await Designation.find(filter).populate("department", "name").sort({ level: -1, name: 1 });
  res.json(designations);
};

export const createDesignation = async (req, res) => {
  if (!req.body.name?.trim()) return res.status(400).json({ message: "name is required" });

  const payload = cleanPayload(req.body);

  let designation;
  try {
    designation = await Designation.create({ ...payload, createdBy: req.user._id });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A designation with this name already exists" });
    throw error;
  }

  writeAuditLog({
    type: "database", event: "hrms.designation.created", action: "hrms.designation.created",
    actorId: req.user._id, targetId: designation._id, oldValue: null, newValue: { name: designation.name },
  });
  res.status(201).json(designation);
};

export const updateDesignation = async (req, res) => {
  const designation = await Designation.findById(req.params.id);
  if (!designation) return res.status(404).json({ message: "Designation not found" });

  const payload = cleanPayload(req.body);
  const oldValue = {};
  const newValue = {};
  for (const field of Object.keys(payload)) {
    oldValue[field] = designation[field];
    designation[field] = payload[field];
    newValue[field] = payload[field];
  }

  try {
    await designation.save();
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A designation with this name already exists" });
    throw error;
  }

  writeAuditLog({
    type: "database", event: "hrms.designation.updated", action: "hrms.designation.updated",
    actorId: req.user._id, targetId: designation._id, oldValue, newValue,
  });
  res.json(designation);
};

export const setDesignationStatus = async (req, res) => {
  const designation = await Designation.findById(req.params.id);
  if (!designation) return res.status(404).json({ message: "Designation not found" });

  const oldStatus = designation.isActive;
  designation.isActive = Boolean(req.body.isActive);
  await designation.save();

  writeAuditLog({
    type: "database", event: "hrms.designation.statusChanged", action: "hrms.designation.statusChanged",
    actorId: req.user._id, targetId: designation._id, oldValue: { isActive: oldStatus }, newValue: { isActive: designation.isActive },
  });
  res.json(designation);
};
