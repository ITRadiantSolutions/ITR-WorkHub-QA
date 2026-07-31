import Submission from "../models/Submission.js";
import KraAssignment from "../models/KraAssignment.js";
import User from "../models/User.js";

const canView = (submission, user) =>
  submission.employeeId.equals(user._id) ||
  (submission.managerId && submission.managerId.equals(user._id)) ||
  user.roles.pms === "hr";

const isAssignedManagerOrHr = (submission, user) =>
  (submission.managerId && submission.managerId.equals(user._id)) || user.roles.pms === "hr";

// Individual ratings are a 1-5 star scale in the UI; null/undefined clears a rating.
const isValidRating = (v) => v === null || v === undefined || (Number.isInteger(v) && v >= 1 && v <= 5);
// managerAvg is a computed average of several 1-5 ratings, so it can be fractional.
const isValidAvgRating = (v) => v === null || v === undefined || (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 5);

// Statuses the employee is allowed to edit/(re)submit responses from.
const EMPLOYEE_EDITABLE_STATUSES = ["draft", "manager_reviewed"];

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
    // The chosen manager must actually be a manager/HR user, and can't be the
    // employee themselves — otherwise an employee could route their own
    // review to themselves and self-approve it later.
    let managerId = req.body.managerId || null;
    if (managerId) {
      if (String(managerId) === String(assignment.assignedTo)) {
        return res.status(400).json({ message: "A submission cannot be routed to the employee themselves" });
      }
      const manager = await User.findById(managerId).select("roles");
      if (!manager || !["manager", "hr"].includes(manager.roles?.pms)) {
        return res.status(400).json({ message: "Selected manager is not a valid manager" });
      }
    }

    try {
      submission = await Submission.create({
        cycleId: assignment.cycleId,
        assignmentId: assignment._id,
        employeeId: assignment.assignedTo,
        managerId,
        kraResponses: assignment.kras.map((k) => ({
          kraId: k._id,
          kraName: k.name,
          weight: k.weight,
          kpis: k.kpis,
        })),
      });
    } catch (err) {
      // Two concurrent opens of the same assignment both see "not found" and
      // race to create — the loser hits the unique index instead of crashing.
      if (err.code === 11000) {
        submission = await Submission.findOne({ cycleId: assignment.cycleId, employeeId: assignment.assignedTo });
        if (!submission) return res.status(409).json({ message: "Failed to open this submission — please try again" });
      } else {
        throw err;
      }
    }
  }

  res.json(submission);
};

// Employee-writable fields only — managerResponse/managerRating/status are
// set exclusively by managerReview, never by the employee's own save.
export const saveResponses = async (req, res) => {
  const submission = await Submission.findById(req.params.id);
  if (!submission) return res.status(404).json({ message: "Submission not found" });
  if (!submission.employeeId.equals(req.user._id)) return res.status(403).json({ message: "Forbidden" });
  if (!EMPLOYEE_EDITABLE_STATUSES.includes(submission.status)) {
    return res.status(409).json({ message: `Cannot edit responses in status '${submission.status}'` });
  }

  const incoming = Array.isArray(req.body.kraResponses) ? req.body.kraResponses : [];
  for (const item of incoming) {
    if (!isValidRating(item.rating)) {
      return res.status(400).json({ message: "Rating must be an integer between 1 and 5" });
    }
  }

  const incomingById = new Map(incoming.map((r) => [String(r.kraId), r]));
  for (const response of submission.kraResponses) {
    const patch = incomingById.get(String(response.kraId));
    if (!patch) continue;
    if (patch.response !== undefined) response.response = patch.response;
    if (patch.rating !== undefined) response.rating = patch.rating;
    if (patch.kpis !== undefined) response.kpis = patch.kpis;
  }

  await submission.save();
  res.json(submission);
};

export const employeeSubmit = async (req, res) => {
  const submission = await Submission.findById(req.params.id);
  if (!submission) return res.status(404).json({ message: "Submission not found" });
  if (!submission.employeeId.equals(req.user._id)) return res.status(403).json({ message: "Forbidden" });
  if (!EMPLOYEE_EDITABLE_STATUSES.includes(submission.status)) {
    return res.status(409).json({ message: `Cannot submit from status '${submission.status}'` });
  }

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
  if (!isAssignedManagerOrHr(submission, req.user)) {
    return res.status(403).json({ message: "You are not the assigned manager for this submission" });
  }
  if (!["employee_submitted", "final_employee_submitted"].includes(submission.status)) {
    return res.status(409).json({ message: `Cannot review a submission with status '${submission.status}'` });
  }

  const { kraReviews } = req.body; // [{ kraId, managerResponse, managerRating }]
  for (const review of kraReviews || []) {
    if (!isValidRating(review.managerRating)) {
      return res.status(400).json({ message: "Rating must be an integer between 1 and 5" });
    }
  }
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
  if (!isAssignedManagerOrHr(submission, req.user)) {
    return res.status(403).json({ message: "You are not the assigned manager for this submission" });
  }

  const { managerSubmitted, managerOverallResponse, managerAvg, overallRating, oneOnOneDate, oneOnOneComment } = req.body;
  if (!isValidRating(overallRating)) {
    return res.status(400).json({ message: "Overall rating must be an integer between 1 and 5" });
  }
  if (!isValidAvgRating(managerAvg)) {
    return res.status(400).json({ message: "Manager average must be a number between 0 and 5" });
  }

  if (managerSubmitted !== undefined) submission.finalReport.managerSubmitted = managerSubmitted;
  if (managerOverallResponse !== undefined) submission.finalReport.managerOverallResponse = managerOverallResponse;
  if (managerAvg !== undefined) submission.finalReport.managerAvg = managerAvg;
  if (overallRating !== undefined) submission.finalReport.overallRating = overallRating;
  if (oneOnOneDate !== undefined) submission.finalReport.oneOnOneDate = oneOnOneDate;
  if (oneOnOneComment !== undefined) submission.finalReport.oneOnOneComment = oneOnOneComment;

  await submission.save();
  res.json(submission);
};
