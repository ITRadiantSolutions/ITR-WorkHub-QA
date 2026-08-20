import HrRequest, { HR_REQUEST_TYPES } from "../models/HrRequest.js";
import User from "../models/User.js";
import { writeAuditLog } from "../utils/activityLog.js";
import { notifyUsers } from "../utils/notify.js";

const populateRequest = (query) =>
  query.populate("requestedBy", "name email").populate("assignedTo", "name email");

const hrUserIds = async () => (await User.find({ "roles.hrms": "hr" }).select("_id")).map((u) => u._id);

export const createHrRequest = async (req, res) => {
  const { type, subject, description } = req.body;
  if (!HR_REQUEST_TYPES.includes(type)) {
    return res.status(400).json({ message: `type must be one of: ${HR_REQUEST_TYPES.join(", ")}` });
  }
  if (!subject?.trim()) return res.status(400).json({ message: "subject is required" });

  const hrRequest = await HrRequest.create({
    requestedBy: req.user._id,
    type,
    subject: subject.trim(),
    description: description?.trim() || "",
  });

  writeAuditLog({
    type: "database", event: "hrms.hrRequest.created", action: "hrms.hrRequest.created",
    actorId: req.user._id, targetId: hrRequest._id, oldValue: null, newValue: { type, status: "open" },
  });
  notifyUsers(await hrUserIds(), {
    title: "New HR request",
    message: `${req.user.name} raised an HR request: "${hrRequest.subject}".`,
    type: "hrRequestSubmitted",
    activityType: "create",
    performedBy: req.user._id,
  });

  res.status(201).json(await populateRequest(HrRequest.findById(hrRequest._id)));
};

export const listMyHrRequests = async (req, res) => {
  const filter = { requestedBy: req.user._id };
  if (req.query.status?.trim()) filter.status = req.query.status.trim();
  const requests = await populateRequest(HrRequest.find(filter)).sort({ createdAt: -1 });
  res.json(requests);
};

export const listHrRequests = async (req, res) => {
  const filter = {};
  if (req.query.status?.trim()) filter.status = req.query.status.trim();
  if (req.query.type?.trim()) filter.type = req.query.type.trim();
  if (req.query.assignedTo?.trim()) filter.assignedTo = req.query.assignedTo.trim();
  const requests = await populateRequest(HrRequest.find(filter)).sort({ createdAt: -1 });
  res.json(requests);
};

export const assignHrRequest = async (req, res) => {
  const hrRequest = await HrRequest.findById(req.params.id);
  if (!hrRequest) return res.status(404).json({ message: "HR request not found" });
  if (hrRequest.status === "resolved") {
    return res.status(409).json({ message: "Cannot reassign a resolved request" });
  }

  hrRequest.assignedTo = req.body.assignedTo || req.user._id;
  if (hrRequest.status === "open") hrRequest.status = "in_progress";
  await hrRequest.save();

  writeAuditLog({
    type: "database", event: "hrms.hrRequest.assigned", action: "hrms.hrRequest.assigned",
    actorId: req.user._id, targetId: hrRequest._id, oldValue: null, newValue: { assignedTo: hrRequest.assignedTo },
  });
  res.json(await populateRequest(HrRequest.findById(hrRequest._id)));
};

export const resolveHrRequest = async (req, res) => {
  const hrRequest = await HrRequest.findById(req.params.id);
  if (!hrRequest) return res.status(404).json({ message: "HR request not found" });
  if (hrRequest.status === "resolved") {
    return res.status(409).json({ message: "This request is already resolved" });
  }

  hrRequest.status = "resolved";
  hrRequest.resolutionNote = req.body.resolutionNote?.trim() || "";
  hrRequest.resolvedAt = new Date();
  await hrRequest.save();

  writeAuditLog({
    type: "database", event: "hrms.hrRequest.resolved", action: "hrms.hrRequest.resolved",
    actorId: req.user._id, targetId: hrRequest._id, oldValue: { status: "open" }, newValue: { status: "resolved" },
  });
  notifyUsers([hrRequest.requestedBy], {
    title: "HR request resolved",
    message: `Your HR request "${hrRequest.subject}" has been resolved.`,
    type: "hrRequestResolved",
    activityType: "status_change",
    performedBy: req.user._id,
  });

  res.json(await populateRequest(HrRequest.findById(hrRequest._id)));
};
