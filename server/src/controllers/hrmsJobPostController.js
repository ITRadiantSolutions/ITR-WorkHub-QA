import JobPost from "../models/JobPost.js";
import { writeAuditLog } from "../utils/activityLog.js";

const POST_FIELDS = [
  "title", "department", "positions", "location", "employmentType", "experienceRequired",
  "skillsRequired", "skillsPreferred", "salaryRangeMin", "salaryRangeMax", "description",
  "priority", "applicationDeadline",
];

export const listJobPosts = async (req, res) => {
  const filter = {};
  if (req.user.roles.hrms === "hr") {
    if (req.query.status?.trim()) filter.status = req.query.status.trim();
  } else {
    filter.status = "published";
  }
  if (req.query.department?.trim()) filter.department = req.query.department.trim();

  const jobPosts = await JobPost.find(filter).sort({ createdAt: -1 });
  res.json(jobPosts);
};

export const getJobPost = async (req, res) => {
  const jobPost = await JobPost.findById(req.params.id);
  if (!jobPost) return res.status(404).json({ message: "Job post not found" });
  if (jobPost.status !== "published" && req.user.roles.hrms !== "hr") {
    return res.status(403).json({ message: "Forbidden" });
  }
  res.json(jobPost);
};

export const createJobPost = async (req, res) => {
  const payload = {};
  for (const field of POST_FIELDS) {
    if (req.body[field] !== undefined) payload[field] = req.body[field];
  }
  if (!payload.title) return res.status(400).json({ message: "title is required" });

  const jobPost = await JobPost.create({ ...payload, createdBy: req.user._id });
  writeAuditLog({
    type: "database", event: "hrms.jobPost.created", action: "hrms.jobPost.created",
    actorId: req.user._id, targetId: jobPost._id, oldValue: null, newValue: { status: jobPost.status },
  });
  res.status(201).json(jobPost);
};

export const updateJobPost = async (req, res) => {
  const jobPost = await JobPost.findById(req.params.id);
  if (!jobPost) return res.status(404).json({ message: "Job post not found" });

  for (const field of POST_FIELDS) {
    if (req.body[field] !== undefined) jobPost[field] = req.body[field];
  }
  await jobPost.save();
  res.json(jobPost);
};

const setStatus = (nextStatus, extraFields = () => ({})) => async (req, res) => {
  const jobPost = await JobPost.findById(req.params.id);
  if (!jobPost) return res.status(404).json({ message: "Job post not found" });

  const oldStatus = jobPost.status;
  jobPost.status = nextStatus;
  Object.assign(jobPost, extraFields());
  await jobPost.save();

  writeAuditLog({
    type: "database", event: `hrms.jobPost.${nextStatus}`, action: `hrms.jobPost.${nextStatus}`,
    actorId: req.user._id, targetId: jobPost._id, oldValue: { status: oldStatus }, newValue: { status: nextStatus },
  });
  res.json(jobPost);
};

export const publishJobPost = setStatus("published", () => ({ publishedAt: new Date() }));
export const closeJobPost = setStatus("closed", () => ({ closedAt: new Date() }));
export const archiveJobPost = setStatus("archived");
