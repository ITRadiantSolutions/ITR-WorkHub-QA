import Announcement, { ANNOUNCEMENT_CATEGORIES } from "../models/Announcement.js";
import { writeAuditLog } from "../utils/activityLog.js";

const FIELDS = ["title", "body", "category", "isPinned", "expiresAt"];

export const listAnnouncements = async (req, res) => {
  const filter = {};
  if (req.query.includeExpired !== "true") {
    filter.$or = [{ expiresAt: null }, { expiresAt: { $gte: new Date() } }];
  }
  const announcements = await Announcement.find(filter)
    .populate("createdBy", "name")
    .sort({ isPinned: -1, createdAt: -1 });
  res.json(announcements);
};

export const createAnnouncement = async (req, res) => {
  if (!req.body.title?.trim()) return res.status(400).json({ message: "title is required" });
  if (req.body.category && !ANNOUNCEMENT_CATEGORIES.includes(req.body.category)) {
    return res.status(400).json({ message: `category must be one of: ${ANNOUNCEMENT_CATEGORIES.join(", ")}` });
  }

  const payload = {};
  for (const field of FIELDS) {
    if (req.body[field] !== undefined) payload[field] = req.body[field];
  }

  const announcement = await Announcement.create({ ...payload, createdBy: req.user._id });

  writeAuditLog({
    type: "database", event: "hrms.announcement.created", action: "hrms.announcement.created",
    actorId: req.user._id, targetId: announcement._id, oldValue: null, newValue: { title: announcement.title },
  });
  res.status(201).json(announcement);
};

export const updateAnnouncement = async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) return res.status(404).json({ message: "Announcement not found" });

  const oldValue = {};
  const newValue = {};
  for (const field of FIELDS) {
    if (req.body[field] === undefined) continue;
    oldValue[field] = announcement[field];
    announcement[field] = req.body[field];
    newValue[field] = req.body[field];
  }
  await announcement.save();

  writeAuditLog({
    type: "database", event: "hrms.announcement.updated", action: "hrms.announcement.updated",
    actorId: req.user._id, targetId: announcement._id, oldValue, newValue,
  });
  res.json(announcement);
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
