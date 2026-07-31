import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import { escapeRegex } from "../utils/taskFilters.js";

const requireAdmin = (req, res) => {
  if (req.user.roles.tracker !== "ADMIN") {
    res.status(403).json({ message: "Admin access required" });
    return false;
  }
  return true;
};

const normalizeBool = (val) => {
  if (val === undefined || val === null) return null;
  const s = String(val).toLowerCase();
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return null;
};

export const getAdminNotifications = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { page = 1, limit = 20, employeeId, performedById, projectId, unreadOnly = "false", readOnly = "false", q } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};
  const unreadBool = normalizeBool(unreadOnly);
  const readBool = normalizeBool(readOnly);
  if (unreadBool === true) filter.isRead = false;
  else if (readBool === true) filter.isRead = true;

  for (const [param, field] of [
    [employeeId, "userId"],
    [performedById, "performedBy"],
    [projectId, "projectId"],
  ]) {
    if (!param) continue;
    if (!mongoose.Types.ObjectId.isValid(param)) {
      return res.status(400).json({ message: `Invalid ${field === "userId" ? "employeeId" : field}` });
    }
    filter[field] = param;
  }

  if (q && String(q).trim()) {
    const qq = escapeRegex(String(q).trim());
    filter.$or = [
      { title: { $regex: qq, $options: "i" } },
      { message: { $regex: qq, $options: "i" } },
      { type: { $regex: qq, $options: "i" } },
    ];
  }

  const [data, total] = await Promise.all([
    Notification.find(filter)
      .populate("userId", "name email")
      .populate("performedBy", "name email")
      .populate("projectId", "name status")
      .populate("taskId", "title status assignees projectId")
      .populate("sprintId", "name status")
      .populate("bugId", "title status")
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip)
      .lean(),
    Notification.countDocuments(filter),
  ]);

  res.json({ success: true, data, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
};

export const getAdminUnreadCount = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employeeId, performedById, projectId } = req.query;

  const filter = { isRead: false };
  if (employeeId) filter.userId = employeeId;
  if (performedById) filter.performedBy = performedById;
  if (projectId) filter.projectId = projectId;

  res.json({ success: true, unreadCount: await Notification.countDocuments(filter) });
};

const PROJECT_TYPES = ["projectCreated", "projectUpdated", "projectDeleted", "projectAssigned"];
const TASK_TYPES = ["taskCreated", "taskUpdated", "taskDeleted", "taskAssigned", "taskStatusChanged", "taskDeadlineUpdated", "taskCommentAdded"];
const SPRINT_TYPES = ["sprintCreated", "sprintUpdated", "sprintDeleted", "storyCreated", "storyUpdated", "storyDeleted"];
const BUG_TYPES = ["bugCreated", "bugUpdated", "bugDeleted", "bugStatusChanged"];

export const getAdminSidebarTabCounts = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employeeId, performedById, projectId } = req.query;

  const base = { isRead: false, userId: req.user._id };
  if (employeeId) base.userId = employeeId;
  if (performedById) base.performedBy = performedById;
  if (projectId) base.projectId = projectId;

  const [counts = {}] = await Notification.aggregate([
    { $match: base },
    {
      $group: {
        _id: null,
        notifications: { $sum: 1 },
        projects: { $sum: { $cond: [{ $in: ["$type", PROJECT_TYPES] }, 1, 0] } },
        tasks: { $sum: { $cond: [{ $in: ["$type", TASK_TYPES] }, 1, 0] } },
        sprints: { $sum: { $cond: [{ $in: ["$type", SPRINT_TYPES] }, 1, 0] } },
        bugs: { $sum: { $cond: [{ $in: ["$type", BUG_TYPES] }, 1, 0] } },
      },
    },
    { $project: { _id: 0 } },
  ]);

  const { projects = 0, tasks = 0, sprints = 0, bugs = 0, notifications = 0 } = counts;
  res.json({ success: true, tabs: { projects, tasks, sprints, bugs, notifications } });
};

const TAB_FILTERS = {
  projects: /^project/i,
  tasks: /^task/i,
  sprints: /^sprint/i,
  bugs: /^bug/i,
  users: /^user/i,
  reports: /^report/i,
};

export const markAdminSidebarTabRead = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employeeId, performedById, projectId, tab = "notifications" } = req.body || {};

  const filter = { isRead: false, userId: req.user._id };
  for (const [param, field] of [
    [employeeId, "userId"],
    [performedById, "performedBy"],
    [projectId, "projectId"],
  ]) {
    if (!param) continue;
    if (!mongoose.Types.ObjectId.isValid(param)) {
      return res.status(400).json({ message: `Invalid ${field === "userId" ? "employeeId" : field}` });
    }
    filter[field] = param;
  }

  if (tab !== "notifications" && tab !== "all") {
    const regex = TAB_FILTERS[tab];
    if (!regex) return res.status(400).json({ success: false, message: "Invalid notification tab." });
    filter.type = regex;
  }

  const result = await Notification.updateMany(filter, { $set: { isRead: true } });
  res.json({ success: true, message: `${tab} notifications marked as read.`, updatedCount: result.modifiedCount || 0 });
};
