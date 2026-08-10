import ProjectRoleAssignment from "../models/ProjectRoleAssignment.js";
import User from "../models/User.js";
import { writeAuditLog } from "../utils/activityLog.js";
import { notifyUsers } from "../utils/notify.js";

// HR can assign a project role to anyone; a manager can only assign one to
// their own direct reports (User.managerId).
const canAssignFor = async (actor, targetUserId) => {
  if (actor.roles.hrms === "hr") return true;
  if (actor.roles.hrms !== "manager") return false;
  const target = await User.findById(targetUserId).select("managerId");
  return Boolean(target?.managerId && target.managerId.equals(actor._id));
};

export const listProjectRoles = async (req, res) => {
  const filter = {};
  if (req.query.userId) filter.user = req.query.userId;
  if (req.query.projectId) filter.project = req.query.projectId;
  if (!filter.user && !filter.projectId) {
    return res.status(400).json({ message: "userId or projectId is required" });
  }

  const assignments = await ProjectRoleAssignment.find(filter)
    .populate("project", "name status")
    .populate("user", "name email")
    .sort({ createdAt: -1 });
  res.json(assignments);
};

export const upsertProjectRole = async (req, res) => {
  const { userId, projectId, role } = req.body;
  if (!userId || !projectId || !role) {
    return res.status(400).json({ message: "userId, projectId and role are required" });
  }
  if (!["employee", "manager", "hr"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }
  if (!(await canAssignFor(req.user, userId))) {
    return res.status(403).json({ message: "You can only assign project roles for your direct reports" });
  }

  const existing = await ProjectRoleAssignment.findOne({ project: projectId, user: userId });
  const oldValue = existing ? { role: existing.role } : null;

  const assignment = await ProjectRoleAssignment.findOneAndUpdate(
    { project: projectId, user: userId },
    { $set: { role, assignedBy: req.user._id } },
    { new: true, upsert: true },
  )
    .populate("project", "name status")
    .populate("user", "name email");

  writeAuditLog({
    type: "database",
    event: "hrms.projectRole.assigned",
    action: "hrms.projectRole.assigned",
    actorId: req.user._id,
    targetId: assignment._id,
    oldValue,
    newValue: { role },
  });
  notifyUsers([userId], {
    title: "Project role updated",
    message: `Your role on "${assignment.project?.name || "a project"}" was set to ${role}.`,
    type: "projectRoleAssigned",
    activityType: "assign",
    performedBy: req.user._id,
    projectId,
  });

  res.json(assignment);
};

export const deleteProjectRole = async (req, res) => {
  const assignment = await ProjectRoleAssignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ message: "Assignment not found" });
  if (!(await canAssignFor(req.user, assignment.user))) {
    return res.status(403).json({ message: "You can only manage project roles for your direct reports" });
  }

  await ProjectRoleAssignment.findByIdAndDelete(req.params.id);
  writeAuditLog({
    type: "database",
    event: "hrms.projectRole.removed",
    action: "hrms.projectRole.removed",
    actorId: req.user._id,
    targetId: assignment._id,
    oldValue: { role: assignment.role, project: assignment.project, user: assignment.user },
    newValue: null,
  });
  res.status(204).send();
};
