import * as XLSX from "xlsx";
import Task from "../models/Task.js";
import User from "../models/User.js";
import Project from "../models/Project.js";
import { buildAccessibleTaskFilter, escapeRegex } from "../utils/taskFilters.js";
import { notifyUsers } from "../utils/notify.js";

const STATUS_LABEL = { IN_PROGRESS: "In Progress", ON_HOLD: "On Hold", QA_TESTING: "QA Testing", DONE: "Done", TODO: "Todo" };

const matchesSearchQuery = (task, query) => {
  const q = query.trim();
  if (!q) return true;
  const regex = new RegExp(escapeRegex(q), "i");
  if (regex.test(task.title || "")) return true;
  if (regex.test(task.description || "")) return true;
  if (regex.test(task.projectId?.name || "")) return true;
  if (regex.test(task.createdBy?.name || "")) return true;
  if (regex.test(task.createdBy?.email || "")) return true;
  return (task.assignees || []).some((a) => regex.test(a.name || "") || regex.test(a.email || ""));
};

export const exportTasksExcel = async (req, res) => {
  const filter = await buildAccessibleTaskFilter(req);
  let tasks = await Task.find(filter)
    .populate("assignees", "name email")
    .populate("projectId", "name")
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 });

  if (req.query.q?.trim()) tasks = tasks.filter((t) => matchesSearchQuery(t, req.query.q));

  const rows = tasks.map((task) => ({
    Task: task.title || "",
    Project: task.projectId?.name || "",
    Assignee: (task.assignees || []).map((a) => a.name).filter(Boolean).join(", ") || "Unassigned",
    Priority: task.priority || "",
    Created: task.createdAt ? new Date(task.createdAt).toLocaleDateString("en-US") : "",
    Due: task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-US") : "",
    Status: STATUS_LABEL[task.status] || "Todo",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=tasks_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  res.send(buffer);
};

const parseImportDate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d+(\.\d+)?$/.test(str)) {
    const d = new Date(Math.round((Number(str) - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

// Bulk-creates tasks from a parsed spreadsheet. Only ADMIN/PM may import.
export const importTasks = async (req, res) => {
  if (!["ADMIN", "PM"].includes(req.user.roles.tracker)) {
    return res.status(403).json({ message: "Access denied: Only Admin and PM can import tasks" });
  }

  const { projectId, tasks: taskRows, defaultAssigneeId } = req.body;
  if (!projectId) return res.status(400).json({ message: "Project ID is required" });
  if (!Array.isArray(taskRows) || !taskRows.length) {
    return res.status(400).json({ message: "No task rows provided" });
  }

  const project = await Project.findById(projectId);
  if (!project) return res.status(404).json({ message: "Project not found" });

  const identifiers = new Set();
  taskRows.forEach((row) => {
    (row.assignees || "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)
      .forEach((e) => identifiers.add(e));
  });

  const allUsers = identifiers.size ? await User.find({}).select("_id email name roles") : [];
  const identifierToUser = new Map();
  for (const identifier of identifiers) {
    const lower = identifier.toLowerCase();
    const match =
      allUsers.find((u) => u.name?.toLowerCase() === lower) || allUsers.find((u) => u.email?.toLowerCase() === lower);
    if (match) identifierToUser.set(identifier, match);
  }

  const defaultUser = defaultAssigneeId ? await User.findById(defaultAssigneeId).select("_id name roles") : null;
  const isNonAssignable = (user) => ["ADMIN", "PM"].includes(user.roles.tracker);
  const results = [];
  const createdTasks = [];

  for (let i = 0; i < taskRows.length; i++) {
    const row = taskRows[i];
    const rowNum = i + 1;
    const errors = [];

    if (!row.title?.trim()) errors.push("Title is required");
    if (!row.dueDate) errors.push("DueDate is required");

    let dueDateObj = null;
    if (row.dueDate) {
      dueDateObj = parseImportDate(row.dueDate);
      if (!dueDateObj) errors.push("Invalid DueDate format. Use YYYY-MM-DD");
    }

    const assigneeIds = (row.assignees || "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)
      .map((id) => identifierToUser.get(id))
      .filter((u) => u && !isNonAssignable(u))
      .map((u) => u._id.toString());
    let finalAssignees = [...new Set(assigneeIds)];
    if (!finalAssignees.length && defaultUser && !isNonAssignable(defaultUser)) {
      finalAssignees = [defaultUser._id.toString()];
    }

    const priority = ["Low", "Medium", "High"].includes(row.priority) ? row.priority : "Medium";
    const status = ["TODO", "IN_PROGRESS", "ON_HOLD", "QA_TESTING", "DONE"].includes(row.status) ? row.status : "TODO";

    if (errors.length) {
      results.push({ row: rowNum, title: row.title || "", status: "error", errors });
      continue;
    }

    try {
      const task = await Task.create({
        title: row.title.trim(),
        description: (row.description || "").trim(),
        projectId,
        assignees: finalAssignees,
        createdBy: req.user._id,
        priority,
        dueDate: dueDateObj,
        status,
        assignedAt: new Date(),
        closedBy: status === "DONE" ? req.user._id : null,
        closedAt: status === "DONE" ? new Date() : null,
      });

      await notifyUsers(finalAssignees, {
        title: "New task assigned",
        message: `${req.user.name} created "${task.title}" in "${project.name}" via import`,
        type: "taskCreated",
        activityType: "create",
        performedBy: req.user._id,
        taskId: task._id,
        projectId,
        metadata: { priority: task.priority, dueDate: task.dueDate, status: task.status, source: "excel_import" },
      });

      createdTasks.push(task);
      results.push({ row: rowNum, title: task.title, status: "success", taskId: task._id });
    } catch (createErr) {
      results.push({ row: rowNum, title: row.title || "", status: "error", errors: [createErr.message] });
    }
  }

  res.status(201).json({
    message: `Import complete: ${createdTasks.length} of ${taskRows.length} tasks created`,
    successCount: createdTasks.length,
    errorCount: taskRows.length - createdTasks.length,
    results,
    data: createdTasks,
  });
};
