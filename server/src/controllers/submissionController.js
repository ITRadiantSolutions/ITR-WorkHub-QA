import Submission from "../models/Submission.js";
import KraAssignment from "../models/KraAssignment.js";
import User from "../models/User.js";
import Cycle from "../models/Cycle.js";

// submission.managerId is a one-time snapshot taken when the employee first
// opens their KRA card (see getOrCreateFromAssignment) — it never gets
// resynced if the employee's manager is reassigned afterward, or was unset
// at that moment. Falling back to the employee's *current* User.managerId
// (the same source kraAssignmentController.js already trusts for assignment
// access) keeps a reassigned manager from being silently locked out.
const isCurrentManagerOf = async (submission, user) => {
  if (user.roles.pms !== "manager") return false;
  const employeeId = submission.employeeId?._id || submission.employeeId;
  const employee = await User.findById(employeeId).select("managerId");
  return Boolean(employee?.managerId?.equals(user._id));
};

const canView = async (submission, user) =>
  submission.employeeId.equals(user._id) ||
  (submission.managerId && submission.managerId.equals(user._id)) ||
  user.roles.pms === "hr" ||
  (await isCurrentManagerOf(submission, user));

const isAssignedManagerOrHr = async (submission, user) =>
  (submission.managerId && submission.managerId.equals(user._id)) ||
  user.roles.pms === "hr" ||
  (await isCurrentManagerOf(submission, user));

// The Cycle's response window (Review Cycles page) was, until now, only
// enforced client-side (TemplateCard.jsx's canRespond) — the API itself
// accepted saves/submits from any employee whose submission status was
// otherwise editable, regardless of whether HR had actually opened (or had
// since closed) the window for them.
//
// A self-reviewing employee can land in either window: the Review Cycles
// user picker only lets HR place "employee"-role users into the Employee
// window and "manager"/"hr"-role users into the Manager/HR window
// (CycleTable.jsx), so a manager/HR-role person's own self-review is only
// ever reachable through the Manager/HR window. Checking employeeResponse
// alone (as this used to) rejected every save/submit for exactly those
// people with a 409, even though the client's canRespond correctly showed
// the form as open — matching TemplateCard.jsx's canRespond check.
const isWindowOpen = (window, employeeId) => {
  if (!window?.enabled) return false;
  if (window.expiry && new Date(window.expiry) < new Date()) return false;
  return (window.selectedUserIds || []).some((id) => id.equals(employeeId));
};

const isEmployeeResponseWindowOpen = async (cycleId, employeeId) => {
  const cycle = await Cycle.findById(cycleId).select("employeeResponse managerResponse");
  return isWindowOpen(cycle?.employeeResponse, employeeId) || isWindowOpen(cycle?.managerResponse, employeeId);
};

// Individual ratings are a 1-5 star scale in the UI; null/undefined clears a rating.
const isValidRating = (v) => v === null || v === undefined || (Number.isInteger(v) && v >= 1 && v <= 5);
// managerAvg is a computed average of several 1-5 ratings, so it can be fractional.
const isValidAvgRating = (v) => v === null || v === undefined || (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 5);

// Statuses the employee is allowed to edit/(re)submit responses from.
const EMPLOYEE_EDITABLE_STATUSES = ["draft", "manager_reviewed"];

export const listSubmissions = async (req, res) => {
  const filter = {};
  if (req.query.cycleId) filter.cycleId = req.query.cycleId;
  // e.g. status=final_manager_reviewed for HR's "finished reports" slice.
  if (req.query.status) filter.status = req.query.status;

  if (req.user.roles.pms === "hr") {
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
  } else if (req.user.roles.pms === "manager") {
    // submission.managerId is a frozen snapshot from whenever the employee
    // first opened their KRA card — it goes stale if the employee is
    // reassigned to a different manager afterward. Also include anyone who
    // *currently* reports to this manager so a reassignment doesn't strand
    // their submissions in the old manager's queue only.
    const directReports = await User.find({ managerId: req.user._id }).select("_id");
    filter.$or = [{ managerId: req.user._id }, { employeeId: { $in: directReports.map((u) => u._id) } }];
  } else {
    filter.employeeId = req.user._id;
  }

  res.json(
    await Submission.find(filter).populate([
      { path: "employeeId", select: "name email" },
      { path: "managerId", select: "name" },
    ]),
  );
};

export const getSubmission = async (req, res) => {
  const submission = await Submission.findById(req.params.id).populate([
    { path: "employeeId", select: "name email" },
    { path: "managerId", select: "name" },
  ]);
  if (!submission) return res.status(404).json({ message: "Submission not found" });
  if (!(await canView(submission, req.user))) return res.status(403).json({ message: "Forbidden" });
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

  await submission.populate({ path: "managerId", select: "name" });
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
  if (!(await isEmployeeResponseWindowOpen(submission.cycleId, submission.employeeId))) {
    return res.status(409).json({ message: "The response window for this cycle isn't open for you yet" });
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
  if (!(await isEmployeeResponseWindowOpen(submission.cycleId, submission.employeeId))) {
    return res.status(409).json({ message: "The response window for this cycle isn't open for you yet" });
  }
  const missingResponse = submission.kraResponses.find((r) => !r.response?.trim() || !r.rating);
  if (missingResponse) {
    return res.status(400).json({ message: `Fill in a response and rating for "${missingResponse.kraName}" before submitting` });
  }

  const isFinal = submission.status === "manager_reviewed";
  submission.status = isFinal ? "final_employee_submitted" : "employee_submitted";
  submission.submittedAt = new Date();
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
  if (!(await isAssignedManagerOrHr(submission, req.user))) {
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

  // Completing a review round needs every KRA covered, not just whichever
  // ones happened to be in this call — otherwise the submission rolls to
  // "manager_reviewed" while some KRAs are left with no manager feedback at
  // all (checked against the merged result, so KRAs reviewed in an earlier
  // call still count).
  const reviewsById = new Map((kraReviews || []).map((r) => [String(r.kraId), r]));
  const incomplete = submission.kraResponses.find((r) => {
    const review = reviewsById.get(String(r.kraId));
    const managerResponse = review?.managerResponse ?? r.managerResponse;
    const managerRating = review?.managerRating ?? r.managerRating;
    return !managerResponse?.trim() || !managerRating;
  });
  if (incomplete) {
    return res.status(400).json({ message: `Add a response and rating for "${incomplete.kraName}" before completing the review` });
  }

  for (const review of kraReviews || []) {
    const target = submission.kraResponses.find((r) => String(r.kraId) === String(review.kraId));
    if (!target) continue;
    target.managerResponse = review.managerResponse ?? target.managerResponse;
    target.managerRating = review.managerRating ?? target.managerRating;
    target.status = "manager_reviewed";
    target.reviewedAt = new Date();
  }

  // Weight-adjusted average of one rating field across every KRA that has
  // both a weight and that rating — normalized by the weight actually
  // present rather than assuming weights sum to exactly 100.
  const weightedAvg = (ratingField) => {
    const rated = submission.kraResponses.filter((r) => r[ratingField] != null && r.weight);
    const totalWeight = rated.reduce((sum, r) => sum + r.weight, 0);
    if (!totalWeight) return null;
    return rated.reduce((sum, r) => sum + r[ratingField] * r.weight, 0) / totalWeight;
  };
  const employeeAvg = weightedAvg("rating");
  const managerAvg = weightedAvg("managerRating");
  submission.finalReport.employeeAvg = employeeAvg;
  submission.finalReport.managerAvg = managerAvg;
  // Overall rating blends the employee's self-assessment and the manager's
  // assessment 50/50 — the manager can still override it in setFinalReport.
  if (employeeAvg != null && managerAvg != null) {
    submission.finalReport.overallRating = Math.round((employeeAvg + managerAvg) / 2);
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
  if (!(await isAssignedManagerOrHr(submission, req.user))) {
    return res.status(403).json({ message: "You are not the assigned manager for this submission" });
  }
  if (submission.status === "draft") {
    return res.status(409).json({ message: "Cannot add a final report before the employee submits their self-review" });
  }

  const { managerSubmitted, managerOverallResponse, managerAvg, overallRating, oneOnOneDate, oneOnOneComment } = req.body;
  if (!isValidRating(overallRating)) {
    return res.status(400).json({ message: "Overall rating must be an integer between 1 and 5" });
  }
  if (!isValidAvgRating(managerAvg)) {
    return res.status(400).json({ message: "Manager average must be a number between 0 and 5" });
  }
  if (oneOnOneDate && new Date(oneOnOneDate) > new Date()) {
    return res.status(400).json({ message: "1:1 meeting date can't be in the future" });
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
