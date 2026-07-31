import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Sprint from "../models/Sprint.js";
import User from "../models/User.js";
import { notifyUsers } from "../utils/notify.js";
import { escapeRegex } from "../utils/taskFilters.js";
import {
  isPMOrAdmin,
  canManageProject,
  canAccessProjectDirectly,
  canPMAccessProject,
  hasProjectAssignedTasks,
} from "../utils/projectAccess.js";

const isHrOrManager = (user) => ["hr", "manager"].includes(user.roles.timesheet) || ["hr", "manager"].includes(user.roles.pms);

// RBAC-scoped project list, also used for /projects/search (same filters,
// applied via query params) — matches Flow_Tracker's original single-handler design.
export const listProjects = async (req, res) => {
  const { q, status, priority } = req.query;
  const role = req.user.roles.tracker;
  const isAdmin = role === "ADMIN" || isHrOrManager(req.user);

  const filter = {};
  if (!isAdmin) {
    if (role === "PM") {
      filter.$or = [{ createdBy: req.user._id }, { projectLead: req.user._id }, { teamMembers: req.user._id }];
    } else {
      const [taskProjectIds, teamProjectIds] = await Promise.all([
        Task.distinct("projectId", { assignees: req.user._id }),
        Project.find({ teamMembers: req.user._id }).distinct("_id"),
      ]);
      filter._id = { $in: [...new Set([...taskProjectIds, ...teamProjectIds].map(String))] };
    }
  }

  if (status && status !== "ALL") filter.status = status;
  if (priority && priority !== "ALL") filter.priority = priority;
  if (q?.trim()) {
    filter.name = new RegExp(escapeRegex(q.trim()), "i");
  }

  const projects = await Project.find(filter)
    .populate("projectLead", "name email")
    .populate("teamMembers", "name email")
    .sort({ createdAt: -1 });
  res.json(projects);
};

export const getProject = async (req, res) => {
  const project = await Project.findById(req.params.id)
    .populate("projectLead", "name email")
    .populate("teamMembers", "name email");
  if (!project) return res.status(404).json({ message: "Project not found" });

  const role = req.user.roles.tracker;
  let authorized = role === "ADMIN" || isHrOrManager(req.user);
  if (!authorized) authorized = role === "PM" ? canPMAccessProject(req.user, project) : canAccessProjectDirectly(req.user, project);
  if (!authorized) authorized = await hasProjectAssignedTasks(Task, project._id, req.user._id);
  if (!authorized) {
    return res.status(403).json({ message: "Access denied. You must be project lead, creator, or have assigned tasks." });
  }

  const [sprints, tasks] = await Promise.all([
    Sprint.find({ projectId: project._id }).populate("createdBy", "name email").sort({ startDate: 1 }),
    Task.find({ projectId: project._id }).populate("assignees", "name email"),
  ]);

  res.json({ ...project.toObject(), sprints, tasks });
};

export const createProject = async (req, res) => {
  const { name, description, pocName, pocEmail, pocPhone, status, priority, startDate, endDate, projectLead, teamMembers } =
    req.body;
  if (!name) return res.status(400).json({ message: "name is required" });
  if (!isPMOrAdmin(req.user) && !isHrOrManager(req.user)) {
    return res.status(403).json({ message: "Only Project Managers and Admins can create projects" });
  }

  const project = await Project.create({
    name,
    description,
    status,
    priority,
    startDate,
    endDate,
    projectLead: projectLead || null,
    teamMembers: teamMembers || [],
    poc: { name: pocName || "", email: (pocEmail || "").toLowerCase(), phone: pocPhone || "" },
    createdBy: req.user._id,
  });
  res.status(201).json(project);
};

export const updateProject = async (req, res) => {
  const { name, description, pocName, pocEmail, pocPhone, status, priority, startDate, endDate, projectLead } =
    req.body;

  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: "Project not found" });
  // HR/timesheet-manager can manage any project (Workspace Management page);
  // a plain PM is still limited to projects they lead/created/are on.
  if (!isHrOrManager(req.user) && !(isPMOrAdmin(req.user) && canManageProject(req.user, project))) {
    return res.status(403).json({ message: "Not authorized to update this project" });
  }

  if (name !== undefined) project.name = name;
  if (description !== undefined) project.description = description;
  if (status !== undefined) project.status = status;
  if (priority !== undefined) project.priority = priority;
  if (startDate !== undefined) project.startDate = startDate;
  if (endDate !== undefined) project.endDate = endDate;
  if (projectLead !== undefined) project.projectLead = projectLead;
  if (pocName !== undefined) project.poc.name = pocName;
  if (pocEmail !== undefined) project.poc.email = pocEmail.toLowerCase();
  if (pocPhone !== undefined) project.poc.phone = pocPhone;

  await project.save();
  res.json(project);
};

export const deleteProject = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: "Project not found" });

  const authorized = req.user.roles.tracker === "ADMIN" || isHrOrManager(req.user) || project.createdBy?.equals(req.user._id);
  if (!authorized) return res.status(403).json({ message: "Only creator or ADMIN can delete" });

  await Promise.all([Sprint.deleteMany({ projectId: project._id }), Task.deleteMany({ projectId: project._id })]);
  await project.deleteOne();
  res.json({ message: "Project and associated data deleted successfully" });
};

export const getProjectEmployees = async (req, res) => {
  if (!["PM", "ADMIN", "DEVELOPER", "QA"].includes(req.user.roles.tracker)) {
    return res.status(403).json({ message: "Access denied" });
  }

  const project = await Project.findById(req.params.projectId)
    .populate("projectLead", "name email")
    .populate("teamMembers", "name email")
    .lean();
  if (!project) return res.status(404).json({ message: "Project not found" });

  if (req.user.roles.tracker === "PM" && !canPMAccessProject(req.user, project)) {
    return res.status(403).json({ message: "Access denied. You are not assigned to this project." });
  }

  const employees = [...project.teamMembers, project.projectLead]
    .filter(Boolean)
    .filter((m, idx, arr) => idx === arr.findIndex((x) => x._id?.toString() === m._id?.toString()));

  res.json({ message: "Project employees fetched successfully", data: employees });
};

export const getProjectSprints = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: "Project not found" });

  const role = req.user.roles.tracker;
  let authorized = role === "ADMIN";
  if (!authorized) authorized = role === "PM" ? canPMAccessProject(req.user, project) : canAccessProjectDirectly(req.user, project);
  if (!authorized) authorized = await hasProjectAssignedTasks(Task, project._id, req.user._id);
  if (!authorized) return res.status(403).json({ message: "Access denied to this project" });

  const sprints = await Sprint.find({ projectId: project._id }).populate("createdBy", "name email").sort({ startDate: 1 }).lean();
  res.json({ message: "Project sprints fetched successfully", sprints, count: sprints.length });
};

// Action-based team membership update matching the frontend's PATCH contract
// (kept alongside the simpler addTeamMember/removeTeamMember below).
export const updateTeamMembers = async (req, res) => {
  const { action, userId } = req.body;
  if (!isPMOrAdmin(req.user)) return res.status(403).json({ message: "Access denied" });

  const project = await Project.findById(req.params.id).populate("teamMembers", "name email");
  if (!project) return res.status(404).json({ message: "Project not found" });

  const user = await User.findById(userId);
  if (!user) return res.status(400).json({ message: "User not found" });

  if (req.user.roles.tracker !== "ADMIN" && !canManageProject(req.user, project)) {
    return res.status(403).json({ message: "Not authorized" });
  }

  const alreadyMember = project.teamMembers.some((m) => (m._id || m).toString() === userId);
  if (action === "add") {
    if (!alreadyMember) project.teamMembers.push(userId);
  } else if (action === "remove") {
    project.teamMembers = project.teamMembers.filter((m) => (m._id || m).toString() !== userId);
  } else {
    return res.status(400).json({ message: "Invalid action" });
  }

  await project.save();
  await project.populate("teamMembers", "name email");

  await notifyUsers([userId], {
    title: `Team Update: ${project.name}`,
    message: `${req.user.name} ${action === "add" ? "added" : "removed"} ${user.name} ${action === "add" ? "to" : "from"} "${project.name}" team`,
    type: action === "add" ? "teamMemberAdded" : "teamMemberRemoved",
    activityType: action === "add" ? "assign" : "remove",
    performedBy: req.user._id,
    projectId: project._id,
    metadata: { action, userId: userId.toString(), projectName: project.name },
  });

  res.json({ message: `${action === "add" ? "Added" : "Removed"} team member successfully`, project });
};

export const addTeamMember = async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "userId is required" });

  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: "Project not found" });

  if (!project.teamMembers.some((id) => id.equals(userId))) {
    project.teamMembers.push(userId);
    await project.save();
  }
  res.json(project);
};

export const removeTeamMember = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: "Project not found" });

  project.teamMembers = project.teamMembers.filter((id) => !id.equals(req.params.userId));
  await project.save();
  res.json(project);
};

export const addHoliday = async (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ message: "date is required" });

  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: "Project not found" });
  if (!isHrOrManager(req.user) && !(isPMOrAdmin(req.user) && canManageProject(req.user, project))) {
    return res.status(403).json({ message: "Not authorized to manage holidays for this project" });
  }

  if (!project.holidays.includes(date)) {
    project.holidays.push(date);
    await project.save();
  }
  res.json(project);
};

export const removeHoliday = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: "Project not found" });
  if (!isHrOrManager(req.user) && !(isPMOrAdmin(req.user) && canManageProject(req.user, project))) {
    return res.status(403).json({ message: "Not authorized to manage holidays for this project" });
  }

  project.holidays = project.holidays.filter((d) => d !== req.params.date);
  await project.save();
  res.json(project);
};

// Opts this project out of a company-wide holiday (e.g. a client who works
// through an India public holiday) — the date stays locked everywhere else.
export const addExcludedHoliday = async (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ message: "date is required" });

  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: "Project not found" });
  if (!isHrOrManager(req.user) && !(isPMOrAdmin(req.user) && canManageProject(req.user, project))) {
    return res.status(403).json({ message: "Not authorized to manage holidays for this project" });
  }

  if (!project.excludedHolidays.includes(date)) {
    project.excludedHolidays.push(date);
    await project.save();
  }
  res.json(project);
};

export const removeExcludedHoliday = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: "Project not found" });
  if (!isHrOrManager(req.user) && !(isPMOrAdmin(req.user) && canManageProject(req.user, project))) {
    return res.status(403).json({ message: "Not authorized to manage holidays for this project" });
  }

  project.excludedHolidays = project.excludedHolidays.filter((d) => d !== req.params.date);
  await project.save();
  res.json(project);
};

// Bulk lookup used by the timesheet UI to grey out holiday dates per project.
export const holidaysByProjectIds = async (req, res) => {
  const { projectIds } = req.body;
  if (!Array.isArray(projectIds)) {
    return res.status(400).json({ message: "projectIds must be an array" });
  }
  const projects = await Project.find({ _id: { $in: projectIds } }, { name: 1, holidays: 1 });
  res.json(Object.fromEntries(projects.map((p) => [p._id.toString(), p.holidays])));
};
