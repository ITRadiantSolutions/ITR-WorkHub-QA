import Bug from "../models/Bug.js";
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import { notifyUsers } from "../utils/notify.js";

const sameId = (a, b) => Boolean(a && b) && (a._id || a).toString() === (b._id || b).toString();

const isProjectMember = (project, userId) =>
  sameId(project?.createdBy, userId) || sameId(project?.projectLead, userId) || (project?.teamMembers || []).some((m) => sameId(m, userId));

// Bug has no projectId of its own — the frontend derives "Project" from
// bug.taskId.projectId, so that nested ref has to be populated too or it
// always shows N/A.
const TASK_WITH_PROJECT_POPULATE = { path: "taskId", select: "title projectId", populate: { path: "projectId", select: "name" } };

export const listBugs = async (req, res) => {
  const filter = {};
  if (req.query.taskId) filter.taskId = req.query.taskId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.severity) filter.severity = req.query.severity;
  res.json(
    await Bug.find(filter)
      .populate("reportedBy", "name email")
      .populate(TASK_WITH_PROJECT_POPULATE)
      .sort({ createdAt: -1 }),
  );
};

export const getBug = async (req, res) => {
  const bug = await Bug.findById(req.params.id).populate("reportedBy", "name email").populate(TASK_WITH_PROJECT_POPULATE);
  if (!bug) return res.status(404).json({ message: "Bug not found" });
  res.json(bug);
};

export const createBug = async (req, res) => {
  if (!["QA", "DEVELOPER", "PM", "ADMIN"].includes(req.user.roles.tracker)) {
    return res.status(403).json({ message: "Access denied" });
  }

  const { title, description, severity, taskId, attachments } = req.body;
  if (!title || !taskId) return res.status(400).json({ message: "title and taskId are required" });

  const task = await Task.findById(taskId);
  if (!task) return res.status(404).json({ message: "Task not found" });

  const project = await Project.findById(task.projectId);
  if (!project) return res.status(404).json({ message: "Project not found" });
  if (req.user.roles.tracker !== "ADMIN" && !isProjectMember(project, req.user._id)) {
    return res.status(403).json({ message: "Access denied" });
  }

  const bug = await Bug.create({
    title,
    description,
    severity,
    taskId,
    attachments: attachments || [],
    reportedBy: req.user._id,
  });

  task.bugs.push(bug._id);
  await task.save();

  await notifyUsers([...task.assignees, task.createdBy], {
    title: "New bug reported",
    message: `A bug was reported on "${task.title}": ${title}`,
    type: "bugCreated",
    activityType: "create",
    performedBy: req.user._id,
    taskId: task._id,
    projectId: task.projectId,
    bugId: bug._id,
  });

  await bug.populate([{ path: "reportedBy", select: "name email" }, TASK_WITH_PROJECT_POPULATE]);
  res.status(201).json(bug);
};

// Generic update (title/description/severity/status) — ADMIN can edit any
// bug, PM only within their own projects, QA only their own reports.
export const updateBug = async (req, res) => {
  const { title, description, severity, status, attachments } = req.body;

  const bug = await Bug.findById(req.params.id).populate(TASK_WITH_PROJECT_POPULATE);
  if (!bug) return res.status(404).json({ message: "Bug not found" });

  const role = req.user.roles.tracker;
  if (role === "PM" && bug.taskId?.projectId) {
    const project = await Project.findById(bug.taskId.projectId._id || bug.taskId.projectId);
    if (project && !isProjectMember(project, req.user._id)) {
      return res.status(403).json({ message: "Access denied: PM can only edit bugs in assigned projects" });
    }
  } else if (role === "QA") {
    if (!sameId(bug.reportedBy, req.user._id)) {
      return res.status(403).json({ message: "Access denied: QA can only edit their own bug reports" });
    }
  } else if (role !== "ADMIN") {
    return res.status(403).json({ message: "Access denied: Only ADMIN, PM, and QA can edit bug reports" });
  }

  const oldStatus = bug.status;
  if (title !== undefined) bug.title = title;
  if (description !== undefined) bug.description = description;
  if (severity !== undefined) bug.severity = severity;
  if (status !== undefined) bug.status = status;
  if (attachments !== undefined) bug.attachments = attachments;
  await bug.save();

  if (status !== undefined && status !== oldStatus) {
    const task = await Task.findById(bug.taskId?._id || bug.taskId);
    if (task) {
      await notifyUsers([...task.assignees, task.createdBy, bug.reportedBy], {
        title: "Bug status changed",
        message: `Bug "${bug.title}" is now ${status}`,
        type: "bugStatusChanged",
        activityType: "status_change",
        performedBy: req.user._id,
        taskId: task._id,
        projectId: task.projectId,
        bugId: bug._id,
        metadata: { oldStatus, newStatus: status },
      });
    }
  }

  res.json({ message: "Bug updated successfully", data: bug });
};

export const deleteBug = async (req, res) => {
  const bug = await Bug.findByIdAndDelete(req.params.id);
  if (!bug) return res.status(404).json({ message: "Bug not found" });
  await Task.updateOne({ _id: bug.taskId }, { $pull: { bugs: bug._id } });
  res.status(204).send();
};
