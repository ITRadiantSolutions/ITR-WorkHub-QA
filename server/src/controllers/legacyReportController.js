import Submission from "../models/Submission.js";
import KraAssignment from "../models/KraAssignment.js";
import User from "../models/User.js";
import Cycle from "../models/Cycle.js";

const baseKraId = (assignmentId, kraSubId) => `${assignmentId}-base-${kraSubId}`;

const kraIdFor = (assignment, subId) => {
  const k = assignment?.kras.id(subId);
  return k?.isEmployeeAdded ? subId.toString() : baseKraId(assignment._id, subId);
};

// Shared by /reports/employee/:id, /reports/manager/:managerId/employee/:id
// and /reports/hr/:id — the same "one employee's full report" view, just
// gated differently by caller role.
async function buildEmployeeReportView(employeeId) {
  const submission = await Submission.findOne({ employeeId })
    .sort({ updatedAt: -1 })
    .populate("employeeId", "name email roles managerId")
    .populate("managerId", "name email");
  if (!submission) return null;

  const assignment = submission.assignmentId ? await KraAssignment.findById(submission.assignmentId) : null;
  const cycle = submission.cycleId ? await Cycle.findById(submission.cycleId) : null;

  const kras = submission.kraResponses.map((r) => ({
    id: r.kraId ? (assignment ? kraIdFor(assignment, r.kraId) : r.kraId.toString()) : null,
    name: r.kraName,
    weight: r.weight,
    kpis: r.kpis || [],
    response: r.response,
    selfRating: r.rating,
    rating: r.rating,
    managerResponse: r.managerResponse,
    managerRating: r.managerRating,
    status: r.status,
  }));

  const rated = kras.filter((k) => k.rating > 0);
  const managerRated = kras.filter((k) => k.managerRating > 0);
  const selfAvg = rated.length ? rated.reduce((s, k) => s + k.rating, 0) / rated.length : null;
  const managerAvg = managerRated.length ? managerRated.reduce((s, k) => s + k.managerRating, 0) / managerRated.length : null;

  return {
    employeeId: submission.employeeId?._id,
    employeeName: submission.employeeId?.name,
    employeeEmail: submission.employeeId?.email,
    employeeRole: submission.employeeId?.roles?.pms,
    reportingManagerName: submission.managerId?.name || null,
    templateId: submission.assignmentId,
    cycle: cycle?.name || null,
    status: submission.status,
    submittedAt: submission.updatedAt,
    kras,
    selfAvg,
    managerAvg,
    overallRating: submission.finalReport.overallRating,
    managerSubmitted: submission.finalReport.managerSubmitted,
    oneOnOneDate: submission.finalReport.oneOnOneDate,
    oneOnOneComment: submission.finalReport.oneOnOneComment,
  };
}

export const getEmployeeReport = async (req, res) => {
  if (req.user.roles.pms === "employee" && req.params.employeeId !== req.user._id.toString()) {
    return res.status(403).json({ message: "Forbidden" });
  }
  const view = await buildEmployeeReportView(req.params.employeeId);
  if (!view) return res.status(404).json({ message: "No report found" });
  res.json(view);
};

export const getManagerEmployeeReport = async (req, res) => {
  if (req.user.roles.pms !== "manager") return res.status(403).json({ message: "PMS Manager access required" });
  const view = await buildEmployeeReportView(req.params.employeeId);
  if (!view) return res.status(404).json({ message: "No report found" });
  res.json(view);
};

export const getHrEmployeeReport = async (req, res) => {
  if (req.user.roles.pms !== "hr") return res.status(403).json({ message: "PMS HR access required" });
  const view = await buildEmployeeReportView(req.params.employeeId);
  if (!view) return res.status(404).json({ message: "No report found" });
  res.json(view);
};

const rowFor = (submission) => ({
  employeeId: submission.employeeId?._id,
  employeeName: submission.employeeId?.name,
  employeeEmail: submission.employeeId?.email,
  employeeRole: submission.employeeId?.roles?.pms,
  status: submission.status,
  overallRating: submission.finalReport.overallRating,
  submittedAt: submission.updatedAt,
  reviewedAt: submission.finalReport.oneOnOneDate,
  managerResponse: submission.finalReport.managerOverallResponse || null,
});

export const listManagerEmployees = async (req, res) => {
  if (req.user.roles.pms !== "manager") return res.status(403).json({ message: "PMS Manager access required" });
  const submissions = await Submission.find({ managerId: req.params.managerId }).populate("employeeId", "name email roles");
  res.json(submissions.map(rowFor));
};

export const listAllEmployeeReports = async (req, res) => {
  if (req.user.roles.pms !== "hr") return res.status(403).json({ message: "PMS HR access required" });
  const submissions = await Submission.find({}).populate("employeeId", "name email roles");
  res.json(submissions.map(rowFor));
};

export const listNonSubmitters = async (req, res) => {
  const { manager_id: managerId } = req.query;
  const userFilter = managerId ? { managerId } : {};
  const users = await User.find(userFilter).select("name email");

  const submitted = new Set((await Submission.find({}).select("employeeId")).map((s) => s.employeeId.toString()));
  const nonSubmitters = users.filter((u) => !submitted.has(u._id.toString()));
  res.json(nonSubmitters.map((u) => ({ id: u._id, name: u.name, email: u.email })));
};

export const submitManagerReview = async (req, res) => {
  if (!["manager", "hr"].includes(req.user.roles.pms)) return res.status(403).json({ message: "Forbidden" });
  const { employeeId, templateId, kras, overallResponse, overallRating, oneOnOneDate, oneOnOneComment } = req.body;

  const submission = await Submission.findOne({ assignmentId: templateId, employeeId });
  if (!submission) return res.status(404).json({ message: "Submission not found" });

  const assignment = await KraAssignment.findById(templateId);
  for (const kra of kras || []) {
    const subId = String(kra.id || kra.kraId || "").includes("-base-")
      ? String(kra.id || kra.kraId).split("-base-").pop()
      : kra.id || kra.kraId;
    const response = submission.kraResponses.find((r) => r.kraId?.toString() === subId);
    if (response) {
      response.managerResponse = kra.managerResponse;
      response.managerRating = kra.managerRating;
      response.status = "manager_reviewed";
      response.reviewedAt = new Date();
    }
  }

  submission.status = "final_manager_reviewed";
  submission.finalReport = {
    managerSubmitted: true,
    managerOverallResponse: overallResponse || "",
    managerAvg: overallRating ?? null,
    overallRating: overallRating ?? null,
    oneOnOneDate: oneOnOneDate || null,
    oneOnOneComment: oneOnOneComment || "",
  };
  await submission.save();
  if (assignment) {
    assignment.status = "final_manager_reviewed";
    await assignment.save();
  }
  res.json({ message: "Manager review submitted" });
};

export const saveDraftReview = async (req, res) => {
  if (!["manager", "hr"].includes(req.user.roles.pms)) return res.status(403).json({ message: "Forbidden" });
  const { employeeId, templateId, kras, oneOnOneDate, oneOnOneComment } = req.body;

  const submission = await Submission.findOne({ assignmentId: templateId, employeeId });
  if (!submission) return res.status(404).json({ message: "Submission not found" });

  for (const kra of kras || []) {
    const subId = String(kra.kraId || "").includes("-base-") ? String(kra.kraId).split("-base-").pop() : kra.kraId;
    const response = submission.kraResponses.find((r) => r.kraId?.toString() === subId);
    if (response) {
      response.managerResponse = kra.managerResponse;
      response.managerRating = kra.managerRating;
    }
  }
  submission.finalReport.oneOnOneDate = oneOnOneDate || submission.finalReport.oneOnOneDate;
  submission.finalReport.oneOnOneComment = oneOnOneComment || submission.finalReport.oneOnOneComment;
  await submission.save();
  res.json({ message: "Draft saved" });
};

// Manager approves/rejects a single employee-drafted KRA, unblocking (or
// not) the employee's ability to submit their self-review.
export const managerActionOnKra = async (req, res) => {
  if (!["manager", "hr"].includes(req.user.roles.pms)) return res.status(403).json({ message: "Forbidden" });
  const { templateId, action } = req.body;

  const assignment = await KraAssignment.findById(templateId);
  if (!assignment) return res.status(404).json({ message: "Template not found" });

  assignment.status = action === "approve" ? "manager_approved" : "rejected";
  await assignment.save();
  res.json({ status: assignment.status });
};
