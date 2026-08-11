import JobRequest from "../models/JobRequest.js";
import JobPost from "../models/JobPost.js";
import User from "../models/User.js";
import { writeAuditLog } from "../utils/activityLog.js";
import { notifyUsers } from "../utils/notify.js";

const REQUEST_FIELDS = [
  "title", "department", "positions", "location", "employmentType", "experienceRequired",
  "skillsRequired", "skillsPreferred", "salaryRangeMin", "salaryRangeMax", "description",
  "businessJustification", "priority", "targetHiringDate",
];

const hrUserIds = async () => (await User.find({ "roles.hrms": "hr" }).select("_id")).map((u) => u._id);

// Salary fields are optional, but when given they're always ₹ lakhs (e.g. 4.5 = ₹4.5L) — cap
// at a sane ceiling so a typo/paste can't store an astronomically large "lakhs" value.
const SALARY_MAX_LAKHS = 999.99;

const validateSalaryRange = (payload) => {
  for (const field of ["salaryRangeMin", "salaryRangeMax"]) {
    const v = payload[field];
    if (v === undefined || v === null || v === "") continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > SALARY_MAX_LAKHS) {
      return `${field} must be between 0 and ${SALARY_MAX_LAKHS} lakhs (INR)`;
    }
  }
  if (
    payload.salaryRangeMin !== undefined && payload.salaryRangeMin !== null && payload.salaryRangeMin !== "" &&
    payload.salaryRangeMax !== undefined && payload.salaryRangeMax !== null && payload.salaryRangeMax !== "" &&
    Number(payload.salaryRangeMin) > Number(payload.salaryRangeMax)
  ) {
    return "salaryRangeMin cannot be greater than salaryRangeMax";
  }
  return null;
};

export const createJobRequest = async (req, res) => {
  const payload = {};
  for (const field of REQUEST_FIELDS) {
    if (req.body[field] !== undefined) payload[field] = req.body[field];
  }
  if (!payload.title) return res.status(400).json({ message: "title is required" });
  const salaryError = validateSalaryRange(payload);
  if (salaryError) return res.status(400).json({ message: salaryError });

  const jobRequest = await JobRequest.create({
    ...payload,
    requestedBy: req.user._id,
    status: "submitted",
  });

  writeAuditLog({
    type: "database", event: "hrms.jobRequest.submitted", action: "hrms.jobRequest.submitted",
    actorId: req.user._id, targetId: jobRequest._id, oldValue: null, newValue: { status: "submitted" },
  });
  notifyUsers(await hrUserIds(), {
    title: "New job request",
    message: `${req.user.name} requested a new opening: "${jobRequest.title}".`,
    type: "jobRequestSubmitted",
    activityType: "create",
    performedBy: req.user._id,
  });

  res.status(201).json(jobRequest);
};

export const listJobRequests = async (req, res) => {
  const filter = {};
  if (req.user.roles.hrms !== "hr") filter.requestedBy = req.user._id;
  else if (req.query.status?.trim()) filter.status = req.query.status.trim();

  const jobRequests = await JobRequest.find(filter)
    .populate("requestedBy", "name email")
    .populate("reviewedBy", "name email")
    .sort({ createdAt: -1 });
  res.json(jobRequests);
};

const canViewRequest = (jobRequest, user) =>
  user.roles.hrms === "hr" || jobRequest.requestedBy.toString() === user._id.toString();

export const getJobRequest = async (req, res) => {
  const jobRequest = await JobRequest.findById(req.params.id)
    .populate("requestedBy", "name email")
    .populate("reviewedBy", "name email")
    .populate("clarifications.askedBy", "name")
    .populate("clarifications.respondedBy", "name");
  if (!jobRequest) return res.status(404).json({ message: "Job request not found" });
  if (!canViewRequest(jobRequest, req.user)) return res.status(403).json({ message: "Forbidden" });
  res.json(jobRequest);
};

// The requesting manager can edit their own request while it's still open
// for changes (before HR has moved it past review).
export const updateJobRequest = async (req, res) => {
  const jobRequest = await JobRequest.findById(req.params.id);
  if (!jobRequest) return res.status(404).json({ message: "Job request not found" });
  if (jobRequest.requestedBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "You can only edit your own job requests" });
  }
  if (!["draft", "clarification_required"].includes(jobRequest.status)) {
    return res.status(409).json({ message: `Cannot edit a request with status '${jobRequest.status}'` });
  }
  const salaryError = validateSalaryRange({
    salaryRangeMin: req.body.salaryRangeMin !== undefined ? req.body.salaryRangeMin : jobRequest.salaryRangeMin,
    salaryRangeMax: req.body.salaryRangeMax !== undefined ? req.body.salaryRangeMax : jobRequest.salaryRangeMax,
  });
  if (salaryError) return res.status(400).json({ message: salaryError });

  for (const field of REQUEST_FIELDS) {
    if (req.body[field] !== undefined) jobRequest[field] = req.body[field];
  }
  if (jobRequest.status === "clarification_required") jobRequest.status = "under_review";
  await jobRequest.save();
  res.json(jobRequest);
};

// HR approves or rejects. Publishing is a separate, explicit step
// (publishFromJobRequest) so HR can review the JobPost fields before it goes
// live to employees/managers.
export const reviewJobRequest = async (req, res) => {
  const { action, rejectionReason } = req.body;
  if (!["approve", "reject"].includes(action)) {
    return res.status(400).json({ message: "action must be 'approve' or 'reject'" });
  }

  const jobRequest = await JobRequest.findById(req.params.id);
  if (!jobRequest) return res.status(404).json({ message: "Job request not found" });
  if (!["submitted", "under_review"].includes(jobRequest.status)) {
    return res.status(409).json({ message: `Cannot review a request with status '${jobRequest.status}'` });
  }

  const oldStatus = jobRequest.status;
  jobRequest.status = action === "approve" ? "approved" : "rejected";
  jobRequest.reviewedBy = req.user._id;
  jobRequest.reviewedAt = new Date();
  if (action === "reject") jobRequest.rejectionReason = rejectionReason || "";
  await jobRequest.save();

  writeAuditLog({
    type: "database", event: `hrms.jobRequest.${jobRequest.status}`, action: `hrms.jobRequest.${jobRequest.status}`,
    actorId: req.user._id, targetId: jobRequest._id, oldValue: { status: oldStatus }, newValue: { status: jobRequest.status },
  });
  notifyUsers([jobRequest.requestedBy], {
    title: `Job request ${jobRequest.status}`,
    message: `Your job request "${jobRequest.title}" was ${jobRequest.status}.`,
    type: jobRequest.status === "approved" ? "jobRequestApproved" : "jobRequestRejected",
    activityType: "status_change",
    performedBy: req.user._id,
  });

  res.json(jobRequest);
};

export const addClarification = async (req, res) => {
  const { question } = req.body;
  if (!question?.trim()) return res.status(400).json({ message: "question is required" });

  const jobRequest = await JobRequest.findById(req.params.id);
  if (!jobRequest) return res.status(404).json({ message: "Job request not found" });
  if (!["submitted", "under_review"].includes(jobRequest.status)) {
    return res.status(409).json({ message: `Cannot ask a question on a request with status '${jobRequest.status}'` });
  }

  jobRequest.clarifications.push({ askedBy: req.user._id, question: question.trim() });
  jobRequest.status = "clarification_required";
  await jobRequest.save();

  notifyUsers([jobRequest.requestedBy], {
    title: "HR needs clarification",
    message: `HR asked a question on your job request "${jobRequest.title}".`,
    type: "jobRequestClarificationRequested",
    activityType: "comment",
    performedBy: req.user._id,
  });

  res.json(jobRequest);
};

export const respondClarification = async (req, res) => {
  const { response } = req.body;
  if (!response?.trim()) return res.status(400).json({ message: "response is required" });

  const jobRequest = await JobRequest.findById(req.params.id);
  if (!jobRequest) return res.status(404).json({ message: "Job request not found" });
  if (jobRequest.requestedBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "You can only respond to clarifications on your own job requests" });
  }

  const open = [...jobRequest.clarifications].reverse().find((c) => !c.response);
  if (!open) return res.status(409).json({ message: "No open clarification to respond to" });
  open.response = response.trim();
  open.respondedBy = req.user._id;
  open.respondedAt = new Date();
  jobRequest.status = "under_review";
  await jobRequest.save();

  notifyUsers(await hrUserIds(), {
    title: "Clarification response",
    message: `${req.user.name} responded on job request "${jobRequest.title}".`,
    type: "jobRequestClarificationResponded",
    activityType: "comment",
    performedBy: req.user._id,
  });

  res.json(jobRequest);
};

export const publishFromJobRequest = async (req, res) => {
  const jobRequest = await JobRequest.findById(req.params.id);
  if (!jobRequest) return res.status(404).json({ message: "Job request not found" });
  if (jobRequest.status !== "approved") {
    return res.status(409).json({ message: "Only an approved request can be published" });
  }

  const jobPost = await JobPost.create({
    title: jobRequest.title,
    department: jobRequest.department,
    positions: jobRequest.positions,
    location: jobRequest.location,
    employmentType: jobRequest.employmentType,
    experienceRequired: jobRequest.experienceRequired,
    skillsRequired: jobRequest.skillsRequired,
    skillsPreferred: jobRequest.skillsPreferred,
    salaryRangeMin: jobRequest.salaryRangeMin,
    salaryRangeMax: jobRequest.salaryRangeMax,
    description: jobRequest.description,
    priority: jobRequest.priority,
    applicationDeadline: req.body.applicationDeadline || null,
    status: "published",
    sourceJobRequest: jobRequest._id,
    createdBy: req.user._id,
    publishedAt: new Date(),
  });

  jobRequest.status = "published";
  jobRequest.publishedJobPost = jobPost._id;
  await jobRequest.save();

  writeAuditLog({
    type: "database", event: "hrms.jobRequest.published", action: "hrms.jobRequest.published",
    actorId: req.user._id, targetId: jobRequest._id, oldValue: { status: "approved" }, newValue: { status: "published", jobPost: jobPost._id },
  });

  res.status(201).json({ jobRequest, jobPost });
};
