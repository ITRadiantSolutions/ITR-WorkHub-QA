import Grade from "../models/Grade.js";
import { writeAuditLog } from "../utils/activityLog.js";

const FIELDS = ["name", "level", "minSalary", "maxSalary"];

export const listGrades = async (req, res) => {
  const filter = req.query.includeInactive === "true" ? {} : { isActive: true };
  const grades = await Grade.find(filter).sort({ level: -1, name: 1 });
  res.json(grades);
};

export const createGrade = async (req, res) => {
  if (!req.body.name?.trim()) return res.status(400).json({ message: "name is required" });

  const payload = {};
  for (const field of FIELDS) {
    if (req.body[field] !== undefined) payload[field] = req.body[field];
  }

  let grade;
  try {
    grade = await Grade.create({ ...payload, createdBy: req.user._id });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A grade with this name already exists" });
    throw error;
  }

  writeAuditLog({
    type: "database", event: "hrms.grade.created", action: "hrms.grade.created",
    actorId: req.user._id, targetId: grade._id, oldValue: null, newValue: { name: grade.name },
  });
  res.status(201).json(grade);
};

export const updateGrade = async (req, res) => {
  const grade = await Grade.findById(req.params.id);
  if (!grade) return res.status(404).json({ message: "Grade not found" });

  const oldValue = {};
  const newValue = {};
  for (const field of FIELDS) {
    if (req.body[field] === undefined) continue;
    oldValue[field] = grade[field];
    grade[field] = req.body[field];
    newValue[field] = req.body[field];
  }

  try {
    await grade.save();
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A grade with this name already exists" });
    throw error;
  }

  writeAuditLog({
    type: "database", event: "hrms.grade.updated", action: "hrms.grade.updated",
    actorId: req.user._id, targetId: grade._id, oldValue, newValue,
  });
  res.json(grade);
};

export const setGradeStatus = async (req, res) => {
  const grade = await Grade.findById(req.params.id);
  if (!grade) return res.status(404).json({ message: "Grade not found" });

  const oldStatus = grade.isActive;
  grade.isActive = Boolean(req.body.isActive);
  await grade.save();

  writeAuditLog({
    type: "database", event: "hrms.grade.statusChanged", action: "hrms.grade.statusChanged",
    actorId: req.user._id, targetId: grade._id, oldValue: { isActive: oldStatus }, newValue: { isActive: grade.isActive },
  });
  res.json(grade);
};
