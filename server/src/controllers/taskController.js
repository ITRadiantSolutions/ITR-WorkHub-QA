import Task from "../models/Task.js";
import User from "../models/User.js";
import { notifyUsers } from "../utils/notify.js";
import { getIO } from "../realtime/socket.js";
import {
  buildAccessibleTaskFilter,
  buildOverdueMatch,
  getCreatedAtRangeMatch,
  escapeRegex,
} from "../utils/taskFilters.js";

const emitTaskChanged = (payload) => getIO()?.emit("task:changed", { occurredAt: Date.now(), ...payload });

const TASK_STATUSES = new Set(["TODO", "IN_PROGRESS", "ON_HOLD", "QA_TESTING", "DONE"]);

// ADMIN/PM see every task; everyone else only their own assignments/creations.
const canAccessTask = (user, task) => {
  const role = user.roles.tracker;
  if (role === "ADMIN" || role === "PM") return true;
  const isAssignee = task.assignees.some((a) => (a._id || a).equals(user._id));
  const isCreator = task.createdBy && (task.createdBy._id || task.createdBy).equals(user._id);
  return Boolean(isAssignee || isCreator);
};

// RBAC-scoped: ADMIN sees everything, everyone else is scoped to projects
// they lead/created/are a team member of, or tasks they're directly assigned.
export const listTasks = async (req, res) => {
  const filter = await buildAccessibleTaskFilter(req);
  if (req.query.assignee) filter.assignees = req.query.assignee;

  const tasks = await Task.find(filter)
    .populate("assignees", "name email")
    .populate("createdBy", "name email roles")
    .sort({ createdAt: -1 });
  res.json(tasks);
};

export const getTask = async (req, res) => {
  const task = await Task.findById(req.params.id)
    .populate("assignees", "name email")
    .populate("createdBy", "name email roles")
    .populate("comments.user", "name email roles");
  if (!task) return res.status(404).json({ message: "Task not found" });
  if (!canAccessTask(req.user, task)) {
    return res.status(403).json({ message: "Access denied: this is not your task, and you are not an admin or PM" });
  }
  res.json(task);
};

export const createTask = async (req, res) => {
  const { title, description, projectId, assignees, priority, dueDate } = req.body;
  if (!title || !projectId || !dueDate) {
    return res.status(400).json({ message: "title, projectId and dueDate are required" });
  }

  const task = await Task.create({
    title,
    description,
    projectId,
    assignees: assignees || [],
    priority,
    dueDate,
    createdBy: req.user._id,
  });

  await notifyUsers(assignees, {
    title: "New task assigned",
    message: `You were assigned to "${title}"`,
    type: "taskAssigned",
    activityType: "assign",
    performedBy: req.user._id,
    taskId: task._id,
    projectId,
  });

  emitTaskChanged({ action: "create", taskId: task._id, projectId });
  res.status(201).json(task);
};

export const updateTask = async (req, res) => {
  const { title, description, priority, dueDate, assignees, status } = req.body;
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });
  if (!canAccessTask(req.user, task)) {
    return res.status(403).json({ message: "Access denied: this is not your task, and you are not an admin or PM" });
  }

  if (title !== undefined) task.title = title;
  if (description !== undefined) task.description = description;
  if (priority !== undefined) task.priority = priority;
  if (dueDate !== undefined) task.dueDate = dueDate;

  if (status !== undefined && status !== task.status) {
    if (!TASK_STATUSES.has(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${[...TASK_STATUSES].join(", ")}` });
    }
    task.status = status;
    if (status === "DONE") {
      task.closedBy = req.user._id;
      task.closedAt = new Date();
    }
  }

  if (assignees !== undefined) {
    const newlyAssigned = assignees.filter((id) => !task.assignees.some((a) => a.equals(id)));
    task.assignees = assignees;
    task.assignedAt = new Date();
    await notifyUsers(newlyAssigned, {
      title: "New task assigned",
      message: `You were assigned to "${task.title}"`,
      type: "taskAssigned",
      activityType: "assign",
      performedBy: req.user._id,
      taskId: task._id,
      projectId: task.projectId,
    });
  }

  await task.save();
  emitTaskChanged({ action: "update", taskId: task._id, projectId: task.projectId });
  res.json(task);
};

export const changeTaskStatus = async (req, res) => {
  const { status } = req.body;
  if (!TASK_STATUSES.has(status)) {
    return res.status(400).json({ message: `Invalid status. Must be one of: ${[...TASK_STATUSES].join(", ")}` });
  }
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });
  if (!canAccessTask(req.user, task)) {
    return res.status(403).json({ message: "Access denied: this is not your task, and you are not an admin or PM" });
  }

  task.status = status;
  if (status === "DONE") {
    task.closedBy = req.user._id;
    task.closedAt = new Date();
  }
  await task.save();

  await notifyUsers([...task.assignees, task.createdBy], {
    title: "Task status changed",
    message: `"${task.title}" is now ${status}`,
    type: "taskStatusChanged",
    activityType: "status_change",
    performedBy: req.user._id,
    taskId: task._id,
    projectId: task.projectId,
    metadata: { status },
  });

  emitTaskChanged({ action: "status", taskId: task._id, projectId: task.projectId, newStatus: status });
  res.json(task);
};

export const addTaskComment = async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim().length < 3) {
    return res.status(400).json({ message: "Comment must be at least 3 characters" });
  }

  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });

  task.comments.push({ user: req.user._id, text });
  await task.save();
  await task.populate("comments.user", "name email roles");

  await notifyUsers([...task.assignees, task.createdBy], {
    title: "New comment",
    message: `New comment on "${task.title}"`,
    type: "taskCommentAdded",
    activityType: "comment",
    performedBy: req.user._id,
    taskId: task._id,
    projectId: task.projectId,
  });

  res.json(task);
};

export const deleteTask = async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });

  const role = req.user.roles.tracker;
  const isCreator = task.createdBy && task.createdBy.equals(req.user._id);
  if (role !== "ADMIN" && role !== "PM" && !isCreator) {
    return res.status(403).json({ message: "Access denied: Only ADMIN, PM or creator can delete" });
  }

  await task.deleteOne();
  emitTaskChanged({ action: "delete", taskId: task._id, projectId: task.projectId });
  res.status(204).send();
};

const STATUS_GROUP_STAGE = {
  $group: {
    _id: null,
    total: { $sum: 1 },
    todo: { $sum: { $cond: [{ $eq: ["$status", "TODO"] }, 1, 0] } },
    progress: { $sum: { $cond: [{ $eq: ["$status", "IN_PROGRESS"] }, 1, 0] } },
    onHold: { $sum: { $cond: [{ $eq: ["$status", "ON_HOLD"] }, 1, 0] } },
    qaTesting: { $sum: { $cond: [{ $eq: ["$status", "QA_TESTING"] }, 1, 0] } },
    done: { $sum: { $cond: [{ $eq: ["$status", "DONE"] }, 1, 0] } },
    overdue: {
      $sum: {
        $cond: [
          { $and: [{ $ne: ["$dueDate", null] }, { $ne: ["$status", "DONE"] }, { $lt: ["$dueDate", new Date(new Date().setHours(0, 0, 0, 0))] }] },
          1,
          0,
        ],
      },
    },
  },
};

const searchLookupStages = (q) => {
  if (!q?.trim()) return [];
  const regex = new RegExp(escapeRegex(q.trim()), "i");
  return [
    { $lookup: { from: "users", localField: "assignees", foreignField: "_id", as: "searchAssignees" } },
    { $lookup: { from: "projects", localField: "projectId", foreignField: "_id", as: "searchProjects" } },
    { $lookup: { from: "users", localField: "createdBy", foreignField: "_id", as: "searchCreators" } },
    {
      $match: {
        $or: [
          { title: regex },
          { description: regex },
          { "searchProjects.name": regex },
          { "searchAssignees.name": regex },
          { "searchAssignees.email": regex },
          { "searchCreators.name": regex },
          { "searchCreators.email": regex },
        ],
      },
    },
  ];
};

export const getTaskSummary = async (req, res) => {
  const filter = await buildAccessibleTaskFilter(req);
  Object.assign(filter, buildOverdueMatch(req.query.overdue));
  const range = getCreatedAtRangeMatch(req.query.createdAtRange || req.query.filterCreated);
  if (range) filter.createdAt = range;

  const pipeline = [{ $match: filter }, ...searchLookupStages(req.query.q), STATUS_GROUP_STAGE];
  const [summary = { total: 0, todo: 0, progress: 0, onHold: 0, qaTesting: 0, done: 0, overdue: 0 }] =
    await Task.aggregate(pipeline);
  delete summary._id;
  res.json({ success: true, data: summary });
};

export const searchTasksGlobal = async (req, res) => {
  const filter = await buildAccessibleTaskFilter(req);
  Object.assign(filter, buildOverdueMatch(req.query.overdue));
  const range = getCreatedAtRangeMatch(req.query.createdAtRange || req.query.filterCreated);
  if (range) filter.createdAt = range;

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = req.query.limit ? Math.max(parseInt(req.query.limit, 10) || 20, 1) : null;
  const skip = limit ? (page - 1) * limit : 0;

  const pipeline = [
    { $match: filter },
    ...searchLookupStages(req.query.q),
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $facet: {
        rows: [{ $skip: skip }, ...(limit ? [{ $limit: limit }] : []), { $project: { _id: 1 } }],
        meta: [STATUS_GROUP_STAGE],
      },
    },
  ];

  const [result] = await Task.aggregate(pipeline).allowDiskUse(true);
  const ids = result?.rows?.map((r) => r._id) || [];
  const docs = ids.length
    ? await Task.find({ _id: { $in: ids } })
        .populate("assignees", "name email")
        .populate("projectId", "name")
        .populate("createdBy", "name email roles")
        .lean()
    : [];
  const byId = new Map(docs.map((t) => [String(t._id), t]));
  const summary = result?.meta?.[0] || { total: 0, todo: 0, progress: 0, onHold: 0, qaTesting: 0, done: 0, overdue: 0 };
  delete summary._id;

  res.json({
    success: true,
    data: ids.map((id) => byId.get(String(id))).filter(Boolean),
    summary,
    pagination: { page, limit, total: summary.total, pages: limit ? Math.max(Math.ceil(summary.total / limit), 1) : 1 },
  });
};

const QA_ROLE_ALIASES = ["QA", "TESTER", "QA_ENGINEER"];

export const qaAssignTester = async (req, res) => {
  const { qaTesterId } = req.body;
  if (!qaTesterId) return res.status(400).json({ message: "qaTesterId is required" });

  const task = await Task.findById(req.params.id).populate("projectId", "teamMembers");
  if (!task) return res.status(404).json({ message: "Task not found" });
  if (!task.projectId) return res.status(404).json({ message: "Project not found" });

  const qaTester = await User.findById(qaTesterId).select("_id name roles");
  if (!qaTester) return res.status(404).json({ message: "QA tester not found" });
  if (!QA_ROLE_ALIASES.includes(qaTester.roles.tracker)) {
    return res.status(400).json({ message: `Invalid QA role: ${qaTester.roles.tracker}` });
  }

  const teamMemberIds = (task.projectId.teamMembers || []).map((m) => m.toString());
  if (!teamMemberIds.includes(qaTester._id.toString())) {
    return res.status(400).json({ message: "QA tester must be in the project team" });
  }

  if (!task.assignees.some((a) => a.equals(qaTester._id))) {
    task.assignees.push(qaTester._id);
  }
  const oldStatus = task.status;
  task.status = "QA_TESTING";
  await task.save();

  await notifyUsers([qaTester._id], {
    title: `Task moved to QA Testing: ${task.title}`,
    message: `"${task.title}" was moved to QA Testing and assigned to you.`,
    type: "taskStatusChanged",
    activityType: "status_change",
    performedBy: req.user._id,
    taskId: task._id,
    projectId: task.projectId._id,
    metadata: { oldStatus, newStatus: "QA_TESTING", assignedQA: qaTesterId },
  });

  const updated = await Task.findById(task._id).populate("assignees", "name email").populate("projectId", "name");
  res.json({ message: "QA assignment saved", data: updated });
};

export const getQaTasks = async (req, res) => {
  const tasks = await Task.find({ assignees: req.user._id })
    .populate("assignees", "name email")
    .populate("projectId", "name")
    .populate("createdBy", "name email roles")
    .sort({ createdAt: -1 });
  res.json({ success: true, data: tasks });
};
