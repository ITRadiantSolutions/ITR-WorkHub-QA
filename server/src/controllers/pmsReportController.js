import * as XLSX from "xlsx";
import Submission from "../models/Submission.js";

const requirePmsHr = (req, res) => {
  if (req.user.roles.pms !== "hr") {
    res.status(403).json({ message: "PMS HR access required" });
    return false;
  }
  return true;
};

const rowsForCycle = async (cycleId) => {
  const submissions = await Submission.find({ cycleId }).populate("employeeId", "name email");
  return submissions.map((s) => ({
    Employee: s.employeeId?.name,
    Email: s.employeeId?.email,
    Status: s.status,
    OverallRating: s.finalReport.overallRating,
    ManagerAvg: s.finalReport.managerAvg,
    OneOnOneDate: s.finalReport.oneOnOneDate ? s.finalReport.oneOnOneDate.toISOString().slice(0, 10) : "",
  }));
};

export const getCycleReport = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const { cycleId } = req.query;
  if (!cycleId) return res.status(400).json({ message: "cycleId is required" });
  res.json(await rowsForCycle(cycleId));
};

export const exportCycleReport = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const { cycleId } = req.query;
  if (!cycleId) return res.status(400).json({ message: "cycleId is required" });

  const rows = await rowsForCycle(cycleId);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "PMS Report");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="pms-cycle-report.xlsx"');
  res.send(buffer);
};

export const getEmployeeReport = async (req, res) => {
  if (req.user.roles.pms !== "hr" && req.params.employeeId !== req.user._id.toString()) {
    return res.status(403).json({ message: "Forbidden" });
  }
  const submissions = await Submission.find({ employeeId: req.params.employeeId }).populate(
    "cycleId",
    "name start end",
  );
  res.json(submissions);
};
