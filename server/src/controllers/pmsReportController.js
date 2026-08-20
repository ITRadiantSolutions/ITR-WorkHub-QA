import * as XLSX from "xlsx";
import Submission from "../models/Submission.js";
import User from "../models/User.js";

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
    SubmittedOn: s.submittedAt ? s.submittedAt.toISOString().slice(0, 16).replace("T", " ") : "",
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

// Who hasn't submitted at all (or, when cycleId is given, for that cycle
// specifically) — a manager only ever gets their own team regardless of
// what manager_id they pass; only HR may look up an arbitrary manager's team.
export const listNonSubmitters = async (req, res) => {
  if (!["manager", "hr"].includes(req.user.roles.pms)) return res.status(403).json({ message: "Forbidden" });
  const managerId = req.user.roles.pms === "manager" ? req.user._id.toString() : req.query.managerId;
  const userFilter = managerId ? { managerId } : {};
  const users = await User.find(userFilter).select("name email");

  const submissionFilter = req.query.cycleId ? { cycleId: req.query.cycleId } : {};
  const submitted = new Set((await Submission.find(submissionFilter).select("employeeId")).map((s) => s.employeeId.toString()));
  const nonSubmitters = users.filter((u) => !submitted.has(u._id.toString()));
  res.json(nonSubmitters.map((u) => ({ id: u._id, name: u.name, email: u.email })));
};

export const getEmployeeReport = async (req, res) => {
  if (req.user.roles.pms !== "hr" && req.params.employeeId !== req.user._id.toString()) {
    return res.status(403).json({ message: "Forbidden" });
  }
  const submissions = await Submission.find({ employeeId: req.params.employeeId }).populate(
    "cycleId",
    "name start end reportVisibility",
  );
  // A non-HR caller viewing their own report is gated by two independent
  // things: the cycle's HR-controlled reportVisibility (none/all/selected),
  // AND whether their own manager has actually sent their final report yet
  // (finalReport.managerSubmitted). Turning reportVisibility on for a cycle
  // is a blanket switch — it used to surface every submission in that cycle
  // the instant it flipped, including ones whose manager hadn't finished
  // (or even started) their final report, showing a clickable "your turn"
  // card for a report that was never actually sent. HR still sees everything
  // regardless, same as before.
  const visible =
    req.user.roles.pms === "hr"
      ? submissions
      : submissions.filter((s) => {
          if (!s.finalReport?.managerSubmitted) return false;
          const mode = s.cycleId?.reportVisibility?.mode;
          if (mode === "all") return true;
          if (mode === "selected") {
            return (s.cycleId?.reportVisibility?.visibleTo || []).some(
              (id) => id.toString() === req.params.employeeId,
            );
          }
          return false;
        });
  res.json(visible);
};
