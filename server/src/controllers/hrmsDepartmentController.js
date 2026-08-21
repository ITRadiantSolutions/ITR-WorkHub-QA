import Department from "../models/Department.js";
import User from "../models/User.js";
import { writeAuditLog } from "../utils/activityLog.js";

const FIELDS = ["name", "code", "description", "headId"];

// User.department is a free-text string (populated by the Azure AD group
// sync — see syncUsersFromAzureGroups in userController.js), separate from
// this Department reference table that HR curates by hand. Bootstraps the
// table from whatever distinct values already exist on employee records,
// instead of HR retyping every department that Azure already gave us.
export const importDepartmentsFromUsers = async (req, res) => {
  const distinctNames = await User.distinct("department");
  const candidateNames = [...new Set(distinctNames.map((n) => n?.trim()).filter(Boolean))];

  const existing = await Department.find({ name: { $in: candidateNames } }).select("name");
  const existingNames = new Set(existing.map((d) => d.name));
  const toCreate = candidateNames.filter((name) => !existingNames.has(name));

  if (toCreate.length === 0) {
    return res.json({ imported: 0, names: [] });
  }

  const created = await Department.insertMany(
    toCreate.map((name) => ({ name, createdBy: req.user._id })),
    { ordered: false },
  );

  writeAuditLog({
    type: "database", event: "hrms.department.importedFromUsers", action: "hrms.department.importedFromUsers",
    actorId: req.user._id, targetId: null, oldValue: null, newValue: { names: toCreate },
  });
  res.json({ imported: created.length, names: created.map((d) => d.name) });
};

export const listDepartments = async (req, res) => {
  const filter = req.query.includeInactive === "true" ? {} : { isActive: true };
  const departments = await Department.find(filter).populate("headId", "name email").sort({ name: 1 });
  res.json(departments);
};

export const createDepartment = async (req, res) => {
  if (!req.body.name?.trim()) return res.status(400).json({ message: "name is required" });

  const payload = {};
  for (const field of FIELDS) {
    if (req.body[field] !== undefined) payload[field] = req.body[field];
  }

  let department;
  try {
    department = await Department.create({ ...payload, createdBy: req.user._id });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A department with this name already exists" });
    throw error;
  }

  writeAuditLog({
    type: "database", event: "hrms.department.created", action: "hrms.department.created",
    actorId: req.user._id, targetId: department._id, oldValue: null, newValue: { name: department.name },
  });
  res.status(201).json(department);
};

export const updateDepartment = async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) return res.status(404).json({ message: "Department not found" });

  const oldValue = {};
  const newValue = {};
  for (const field of FIELDS) {
    if (req.body[field] === undefined) continue;
    oldValue[field] = department[field];
    department[field] = req.body[field];
    newValue[field] = req.body[field];
  }

  try {
    await department.save();
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A department with this name already exists" });
    throw error;
  }

  writeAuditLog({
    type: "database", event: "hrms.department.updated", action: "hrms.department.updated",
    actorId: req.user._id, targetId: department._id, oldValue, newValue,
  });
  res.json(department);
};

export const setDepartmentStatus = async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) return res.status(404).json({ message: "Department not found" });

  const oldStatus = department.isActive;
  department.isActive = Boolean(req.body.isActive);
  await department.save();

  writeAuditLog({
    type: "database", event: "hrms.department.statusChanged", action: "hrms.department.statusChanged",
    actorId: req.user._id, targetId: department._id, oldValue: { isActive: oldStatus }, newValue: { isActive: department.isActive },
  });
  res.json(department);
};
