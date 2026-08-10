import Referral from "../models/Referral.js";
import Candidate from "../models/Candidate.js";
import User from "../models/User.js";
import { uploadAttachment, createReadUrl } from "../config/blobStorage.js";
import { writeAuditLog } from "../utils/activityLog.js";
import { notifyUsers } from "../utils/notify.js";

const ALLOWED_RESUME_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const hrUserIds = async () => (await User.find({ "roles.hrms": "hr" }).select("_id")).map((u) => u._id);

export const createReferral = async (req, res) => {
  const { jobId, notes } = req.body;
  let candidateInput = req.body.candidate;
  if (typeof candidateInput === "string") {
    try {
      candidateInput = JSON.parse(candidateInput);
    } catch {
      return res.status(400).json({ message: "candidate must be valid JSON" });
    }
  }
  if (!jobId || !candidateInput?.name || !candidateInput?.email) {
    return res.status(400).json({ message: "jobId, candidate.name and candidate.email are required" });
  }

  if (req.file && !ALLOWED_RESUME_MIME_TYPES.includes(req.file.mimetype)) {
    return res.status(400).json({ message: `Unsupported file type: ${req.file.mimetype}. Only PDF and Word documents are allowed.` });
  }

  const candidate = await Candidate.findOneAndUpdate(
    { email: candidateInput.email.trim().toLowerCase() },
    {
      $setOnInsert: {
        name: candidateInput.name,
        email: candidateInput.email.trim().toLowerCase(),
        phone: candidateInput.phone || "",
        experienceYears: candidateInput.experienceYears ?? null,
        currentCompany: candidateInput.currentCompany || "",
        skills: candidateInput.skills || [],
      },
    },
    { new: true, upsert: true },
  );

  if (req.file) {
    const uploaded = await uploadAttachment({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      scope: "hrms-resume",
      parentId: candidate._id.toString(),
    });
    candidate.resumeBlobName = uploaded.blobName;
    candidate.resumeFileName = req.file.originalname;
    await candidate.save();
  }

  let referral;
  try {
    referral = await Referral.create({
      candidate: candidate._id,
      job: jobId,
      referredBy: req.user._id,
      notes: notes || "",
      statusHistory: [{ status: "submitted", changedBy: req.user._id }],
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "This candidate has already been referred for this job" });
    }
    throw error;
  }

  writeAuditLog({
    type: "database", event: "hrms.referral.submitted", action: "hrms.referral.submitted",
    actorId: req.user._id, targetId: referral._id, oldValue: null, newValue: { status: "submitted" },
  });
  notifyUsers(await hrUserIds(), {
    title: "New referral",
    message: `${req.user.name} referred ${candidate.name} for a role.`,
    type: "referralSubmitted",
    activityType: "create",
    performedBy: req.user._id,
  });

  res.status(201).json(await referral.populate(["candidate", "job"]));
};

export const listMyReferrals = async (req, res) => {
  const referrals = await Referral.find({ referredBy: req.user._id })
    .populate("candidate")
    .populate("job", "title department status")
    .sort({ createdAt: -1 });
  res.json(referrals);
};

export const listAllReferrals = async (req, res) => {
  const filter = {};
  if (req.query.status?.trim()) filter.status = req.query.status.trim();
  if (req.query.jobId?.trim()) filter.job = req.query.jobId.trim();

  const referrals = await Referral.find(filter)
    .populate("candidate")
    .populate("job", "title department status")
    .populate("referredBy", "name email")
    .sort({ createdAt: -1 });
  res.json(referrals);
};

export const updateReferralStatus = async (req, res) => {
  const { status, note, hrNotes } = req.body;
  const VALID = ["submitted", "under_review", "shortlisted", "interview_scheduled", "selected", "rejected", "on_hold"];
  if (!VALID.includes(status)) return res.status(400).json({ message: "Invalid status" });

  const referral = await Referral.findById(req.params.id);
  if (!referral) return res.status(404).json({ message: "Referral not found" });

  const oldStatus = referral.status;
  referral.status = status;
  if (hrNotes !== undefined) referral.hrNotes = hrNotes;
  referral.statusHistory.push({ status, changedBy: req.user._id, note: note || "" });
  await referral.save();

  writeAuditLog({
    type: "database", event: "hrms.referral.statusChanged", action: "hrms.referral.statusChanged",
    actorId: req.user._id, targetId: referral._id, oldValue: { status: oldStatus }, newValue: { status },
  });
  notifyUsers([referral.referredBy], {
    title: "Referral status updated",
    message: `Your referral status changed to "${status}".`,
    type: "referralStatusChanged",
    activityType: "status_change",
    performedBy: req.user._id,
  });

  res.json(await referral.populate(["candidate", "job"]));
};

const canAccessResume = (referral, user) =>
  user.roles.hrms === "hr" || referral.referredBy.toString() === user._id.toString();

export const getResumeUrl = async (req, res) => {
  const referral = await Referral.findById(req.params.id).populate("candidate");
  if (!referral) return res.status(404).json({ message: "Referral not found" });
  if (!canAccessResume(referral, req.user)) return res.status(403).json({ message: "Forbidden" });
  if (!referral.candidate?.resumeBlobName) return res.status(404).json({ message: "No resume uploaded" });

  res.json({ url: createReadUrl(referral.candidate.resumeBlobName) });
};
