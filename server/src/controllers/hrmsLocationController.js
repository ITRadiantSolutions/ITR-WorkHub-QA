import Location from "../models/Location.js";
import { writeAuditLog } from "../utils/activityLog.js";

const FIELDS = ["name", "city", "country", "address", "isHeadOffice"];

export const listLocations = async (req, res) => {
  const filter = req.query.includeInactive === "true" ? {} : { isActive: true };
  const locations = await Location.find(filter).sort({ name: 1 });
  res.json(locations);
};

export const createLocation = async (req, res) => {
  if (!req.body.name?.trim()) return res.status(400).json({ message: "name is required" });

  const payload = {};
  for (const field of FIELDS) {
    if (req.body[field] !== undefined) payload[field] = req.body[field];
  }

  let location;
  try {
    location = await Location.create({ ...payload, createdBy: req.user._id });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A location with this name already exists" });
    throw error;
  }

  writeAuditLog({
    type: "database", event: "hrms.location.created", action: "hrms.location.created",
    actorId: req.user._id, targetId: location._id, oldValue: null, newValue: { name: location.name },
  });
  res.status(201).json(location);
};

export const updateLocation = async (req, res) => {
  const location = await Location.findById(req.params.id);
  if (!location) return res.status(404).json({ message: "Location not found" });

  const oldValue = {};
  const newValue = {};
  for (const field of FIELDS) {
    if (req.body[field] === undefined) continue;
    oldValue[field] = location[field];
    location[field] = req.body[field];
    newValue[field] = req.body[field];
  }

  try {
    await location.save();
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A location with this name already exists" });
    throw error;
  }

  writeAuditLog({
    type: "database", event: "hrms.location.updated", action: "hrms.location.updated",
    actorId: req.user._id, targetId: location._id, oldValue, newValue,
  });
  res.json(location);
};

export const setLocationStatus = async (req, res) => {
  const location = await Location.findById(req.params.id);
  if (!location) return res.status(404).json({ message: "Location not found" });

  const oldStatus = location.isActive;
  location.isActive = Boolean(req.body.isActive);
  await location.save();

  writeAuditLog({
    type: "database", event: "hrms.location.statusChanged", action: "hrms.location.statusChanged",
    actorId: req.user._id, targetId: location._id, oldValue: { isActive: oldStatus }, newValue: { isActive: location.isActive },
  });
  res.json(location);
};
