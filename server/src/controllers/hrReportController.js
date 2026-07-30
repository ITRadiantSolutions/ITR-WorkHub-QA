import * as XLSX from "xlsx";
import Timesheet from "../models/Timesheet.js";
import { flattenTimesheetRows } from "../utils/timesheetEntries.js";

const requireHr = (req, res) => {
  if (req.user.roles.timesheet !== "hr") {
    res.status(403).json({ message: "HR access required" });
    return false;
  }
  return true;
};

const buildDateFilter = (req) => {
  const filter = { status: { $in: ["submitted", "approved"] } };
  if (req.query.startDate) filter.weekEnd = { $gte: new Date(req.query.startDate) };
  if (req.query.endDate) filter.weekStart = { ...(filter.weekStart || {}), $lte: new Date(req.query.endDate) };
  return filter;
};

const fetchEntries = async (filter) => {
  const timesheets = await Timesheet.find(filter)
    .populate("userId", "name email")
    .populate("rows.projectId", "name");
  return flattenTimesheetRows(timesheets);
};

export const getReport = async (req, res) => {
  if (!requireHr(req, res)) return;
  res.json(await fetchEntries(buildDateFilter(req)));
};

export const getUserReport = async (req, res) => {
  if (!requireHr(req, res)) return;
  const filter = { ...buildDateFilter(req), userId: req.params.userId };
  res.json(await fetchEntries(filter));
};

export const getAllUsersSummary = async (req, res) => {
  if (!requireHr(req, res)) return;
  const entries = await fetchEntries(buildDateFilter(req));

  const byUser = new Map();
  for (const e of entries) {
    const cur = byUser.get(e.userId) || { userId: e.userId, userName: e.userName, totalHours: 0 };
    cur.totalHours += e.hours;
    byUser.set(e.userId, cur);
  }
  res.json([...byUser.values()]);
};

export const getProjectSummary = async (req, res) => {
  if (!requireHr(req, res)) return;
  const entries = await fetchEntries(buildDateFilter(req));

  const byProject = new Map();
  for (const e of entries) {
    if (!e.projectId) continue;
    const cur = byProject.get(e.projectId) || { projectId: e.projectId, projectName: e.projectName, totalHours: 0 };
    cur.totalHours += e.hours;
    byProject.set(e.projectId, cur);
  }
  res.json([...byProject.values()]);
};

const sendXlsx = (res, filename, rows) => {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
};

export const exportReport = async (req, res) => {
  if (!requireHr(req, res)) return;
  const entries = await fetchEntries(buildDateFilter(req));
  sendXlsx(
    res,
    "timesheet-report.xlsx",
    entries.map((e) => ({
      Date: e.date.toISOString().slice(0, 10),
      Employee: e.userName,
      Project: e.projectName,
      Hours: e.hours,
      Status: e.status,
    })),
  );
};

export const downloadProjectReport = async (req, res) => {
  if (!requireHr(req, res)) return;
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ message: "projectId is required" });

  const entries = (await fetchEntries(buildDateFilter(req))).filter((e) => e.projectId === projectId);
  sendXlsx(
    res,
    "project-report.xlsx",
    entries.map((e) => ({
      Date: e.date.toISOString().slice(0, 10),
      Employee: e.userName,
      Hours: e.hours,
      Status: e.status,
    })),
  );
};
