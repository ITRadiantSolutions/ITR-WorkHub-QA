import Announcement, { ANNOUNCEMENT_CATEGORIES } from "../models/Announcement.js";
import { uploadAttachment, createReadUrl } from "../config/blobStorage.js";
import { writeAuditLog } from "../utils/activityLog.js";

const FIELDS = ["title", "body", "category", "isPinned", "expiresAt"];
const ALLOWED_ATTACHMENT_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// An <input type="date"> submits a bare "YYYY-MM-DD" string. new Date() on
// that parses as UTC midnight, which is 5:30am IST the same day — an
// announcement HR means to keep visible "through" that date would already
// read as expired for most of it. Anchor date-only values to end-of-day IST
// instead (18:29:59.999 UTC == 23:59:59.999 IST, same calendar date).
const normalizeExpiresAt = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (DATE_ONLY.test(value)) return new Date(`${value}T18:29:59.999Z`);
  return value;
};

const populateAnnouncement = (query) => query.populate("createdBy", "name").populate("acknowledgedBy.user", "name email");

export const listAnnouncements = async (req, res) => {
  const filter = {};
  if (req.query.includeExpired !== "true") {
    filter.$or = [{ expiresAt: null }, { expiresAt: { $gte: new Date() } }];
  }
  const announcements = await populateAnnouncement(Announcement.find(filter)).sort({ isPinned: -1, createdAt: -1 });
  res.json(announcements);
};

export const createAnnouncement = async (req, res) => {
  if (!req.body.title?.trim()) return res.status(400).json({ message: "title is required" });
  if (req.body.category && !ANNOUNCEMENT_CATEGORIES.includes(req.body.category)) {
    return res.status(400).json({ message: `category must be one of: ${ANNOUNCEMENT_CATEGORIES.join(", ")}` });
  }
  if (req.file && !ALLOWED_ATTACHMENT_MIME_TYPES.includes(req.file.mimetype)) {
    return res.status(400).json({ message: `Unsupported file type: ${req.file.mimetype}. Only PDF, PNG and JPEG are allowed.` });
  }

  const payload = {};
  for (const field of FIELDS) {
    if (req.body[field] === undefined) continue;
    payload[field] = field === "expiresAt" ? normalizeExpiresAt(req.body[field]) : req.body[field];
  }

  const announcement = await Announcement.create({ ...payload, createdBy: req.user._id });

  if (req.file) {
    const uploaded = await uploadAttachment({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      scope: "hrms-announcement-attachment",
      parentId: announcement._id.toString(),
    });
    announcement.attachmentBlobName = uploaded.blobName;
    announcement.attachmentFileName = req.file.originalname;
    await announcement.save();
  }

  writeAuditLog({
    type: "database", event: "hrms.announcement.created", action: "hrms.announcement.created",
    actorId: req.user._id, targetId: announcement._id, oldValue: null, newValue: { title: announcement.title },
  });
  res.status(201).json(await populateAnnouncement(Announcement.findById(announcement._id)));
};

export const updateAnnouncement = async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) return res.status(404).json({ message: "Announcement not found" });
  if (req.body.category && !ANNOUNCEMENT_CATEGORIES.includes(req.body.category)) {
    return res.status(400).json({ message: `category must be one of: ${ANNOUNCEMENT_CATEGORIES.join(", ")}` });
  }
  if (req.file && !ALLOWED_ATTACHMENT_MIME_TYPES.includes(req.file.mimetype)) {
    return res.status(400).json({ message: `Unsupported file type: ${req.file.mimetype}. Only PDF, PNG and JPEG are allowed.` });
  }

  const oldValue = {};
  const newValue = {};
  for (const field of FIELDS) {
    if (req.body[field] === undefined) continue;
    const value = field === "expiresAt" ? normalizeExpiresAt(req.body[field]) : req.body[field];
    oldValue[field] = announcement[field];
    announcement[field] = value;
    newValue[field] = value;
  }

  if (req.file) {
    const uploaded = await uploadAttachment({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      scope: "hrms-announcement-attachment",
      parentId: announcement._id.toString(),
    });
    announcement.attachmentBlobName = uploaded.blobName;
    announcement.attachmentFileName = req.file.originalname;
  }

  await announcement.save();

  writeAuditLog({
    type: "database", event: "hrms.announcement.updated", action: "hrms.announcement.updated",
    actorId: req.user._id, targetId: announcement._id, oldValue, newValue,
  });
  res.json(await populateAnnouncement(Announcement.findById(announcement._id)));
};

export const deleteAnnouncement = async (req, res) => {
  const announcement = await Announcement.findByIdAndDelete(req.params.id);
  if (!announcement) return res.status(404).json({ message: "Announcement not found" });

  writeAuditLog({
    type: "database", event: "hrms.announcement.deleted", action: "hrms.announcement.deleted",
    actorId: req.user._id, targetId: announcement._id, oldValue: { title: announcement.title }, newValue: null,
  });
  res.status(204).end();
};

// Any hrms user acknowledges — idempotent, so repeat clicks/requests don't
// pile up duplicate entries or bump the timestamp.
export const acknowledgeAnnouncement = async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) return res.status(404).json({ message: "Announcement not found" });

  const already = announcement.acknowledgedBy.some((a) => a.user.toString() === req.user._id.toString());
  if (!already) {
    announcement.acknowledgedBy.push({ user: req.user._id, at: new Date() });
    await announcement.save();
  }

  res.json(await populateAnnouncement(Announcement.findById(announcement._id)));
};

export const getAnnouncementAttachmentUrl = async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) return res.status(404).json({ message: "Announcement not found" });
  if (!announcement.attachmentBlobName) return res.status(404).json({ message: "No attachment on this announcement" });

  res.json({ url: createReadUrl(announcement.attachmentBlobName), fileName: announcement.attachmentFileName });
};
