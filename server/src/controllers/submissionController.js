import Submission from "../models/Submission.js";
import KraAssignment from "../models/KraAssignment.js";

const canView = (submission, user) =>
  submission.employeeId.equals(user._id) ||
  (submission.managerId && submission.managerId.equals(user._id)) ||
  user.roles.pms === "hr";

export const listSubmissions = async (req, res) => {
  const filter = {};
  if (req.query.cycleId) filter.cycleId = req.query.cycleId;

  if (req.user.roles.pms === "hr") {
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
  } else if (req.user.roles.pms === "manager") {
    filter.managerId = req.user._id;
  } else {
    filter.employeeId = req.user._id;
  }

  res.json(await Submission.find(filter).populate("employeeId", "name email"));
};

export const getSubmission = async (req, res) => {
  const submission = await Submission.findById(req.params.id).populate("employeeId", "name email");
  if (!submission) return res.status(404).json({ message: "Submission not found" });
  if (!canView(submission, req.user)) return res.status(403).json({ message: "Forbidden" });
  res.json(submission);
};

// Get-or-create the employee's working submission doc for an assignment,
// seeding kraResponses from the assignment the first time it's opened.
export const getOrCreateFromAssignment = async (req, res) => {
  const assignment = await KraAssignment.findById(req.params.assignmentId);
  if (!assignment) return res.status(404).json({ message: "Assignment not found" });
  if (!assignment.assignedTo.equals(req.user._id) && req.user.roles.pms !== "hr") {
    return res.status(403).json({ message: "Forbidden" });
  }

  let submission = await Submission.findOne({
    cycleId: assignment.cycleId,
    employeeId: assignment.assignedTo,
  });

  if (!submission) {
    submission = await Submission.create({
      cycleId: assignment.cycleId,
      assignmentId: assignment._id,
      employeeId: assignment.assignedTo,
      managerId: req.body.managerId || null,
      kraResponses: assignment.kras.map((k) => ({
        kraId: k._id,
        kraName: k.name,
        weight: k.weight,
        kpis: k.kpis,
      })),
    });
  }

  res.json(submission);
};

export const saveResponses = async (req, res) => {
  const submission = await Submission.findById(req.params.id);
  if (!submission) return res.status(404).json({ message: "Submission not found" });
  if (!submission.employeeId.equals(req.user._id)) return res.status(403).json({ message: "Forbidden" });
  if (!["draft", "manager_reviewed"].includes(submission.status)) {
    return res.status(409).json({ message: `Cannot edit responses in status '${submission.status}'` });
  }

  submission.kraResponses = req.body.kraResponses || submission.kraResponses;
  await submission.save();
  res.json(submission);
};

export const employeeSubmit = async (req, res) => {
  const submission = await Submission.findById(req.params.id);
  if (!submission) return res.status(404).json({ message: "Submission not found" });
  if (!submission.employeeId.equals(req.user._id)) return res.status(403).json({ message: "Forbidden" });

  const isFinal = submission.status === "manager_reviewed";
  submission.status = isFinal ? "final_employee_submitted" : "employee_submitted";
  for (const response of submission.kraResponses) {
    response.status = "employee_submitted";
    response.employeeSubmittedAt = new Date();
  }
  await submission.save();
  res.json(submission);
};

export const managerReview = async (req, res) => {
  const submission = await Submission.findById(req.params.id);
  if (!submission) return res.status(404).json({ message: "Submission not found" });
  if (!["manager", "hr"].includes(req.user.roles.pms)) return res.status(403).json({ message: "Forbidden" });

  const { kraReviews } = req.body; // [{ kraId, managerResponse, managerRating }]
  for (const review of kraReviews || []) {
    const target = submission.kraResponses.find((r) => String(r.kraId) === String(review.kraId));
    if (!target) continue;
    target.managerResponse = review.managerResponse ?? target.managerResponse;
    target.managerRating = review.managerRating ?? target.managerRating;
    target.status = "manager_reviewed";
    target.reviewedAt = new Date();
  }

  const isFinalRound = submission.status === "final_employee_submitted";
  submission.status = isFinalRound ? "final_manager_reviewed" : "manager_reviewed";
  await submission.save();
  res.json(submission);
};

export const setFinalReport = async (req, res) => {
  if (!["manager", "hr"].includes(req.user.roles.pms)) return res.status(403).json({ message: "Forbidden" });

  const submission = await Submission.findById(req.params.id);
  if (!submission) return res.status(404).json({ message: "Submission not found" });

  Object.assign(submission.finalReport, req.body);
  await submission.save();
  res.json(submission);
};
