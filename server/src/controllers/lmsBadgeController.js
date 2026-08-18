import mongoose from "mongoose";
import Badge from "../models/Badge.js";
import { uploadAttachment, deleteAttachments, createReadUrl } from "../config/blobStorage.js";

// Ported from the standalone LMS project's badgeController.js.

const isManager = (user) => user.isSuperAdmin || ["manager", "admin"].includes(user.roles.lms);

const resolveBadge = (badge) => {
  if (!badge) return badge;
  const obj = typeof badge.toObject === "function" ? badge.toObject() : badge;
  return { ...obj, imageUrl: obj.imageUrl && !obj.imageUrl.startsWith("http") ? createReadUrl(obj.imageUrl) : obj.imageUrl };
};

export const createBadge = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const { name, description, category, color, isAutoAwarded, criteria, order, isActive } = req.body;

  let imageBlobName = req.body.imageUrl;
  if (req.file) {
    const badgeId = new mongoose.Types.ObjectId();
    const uploaded = await uploadAttachment({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      scope: "lms-badge-images",
      parentId: badgeId,
    });
    imageBlobName = uploaded.blobName;
    req.body._badgeId = badgeId;
  }

  if (!name || !description || !imageBlobName) {
    return res.status(400).json({ message: "name, description, and imageUrl are required" });
  }

  const existingBadge = await Badge.findOne({ name });
  if (existingBadge) return res.status(409).json({ message: "Badge with this name already exists" });

  const badge = await Badge.create({
    ...(req.body._badgeId ? { _id: req.body._badgeId } : {}),
    name,
    description,
    imageUrl: imageBlobName,
    category: category || "General",
    color: color || "#7C3AED",
    isAutoAwarded: isAutoAwarded !== undefined ? isAutoAwarded : true,
    criteria: criteria || "pass_assessment",
    order: order || 0,
    isActive: isActive !== undefined ? isActive : true,
  });

  res.status(201).json({ message: "Badge created successfully", badge: resolveBadge(badge) });
};

export const getAllBadges = async (req, res) => {
  const badges = await Badge.find({ isActive: true }).sort({ order: 1, name: 1 });
  res.json(badges.map(resolveBadge));
};

export const getAllBadgesAdmin = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const badges = await Badge.find().sort({ order: 1, name: 1 });
  res.json(badges.map(resolveBadge));
};

export const getBadgeById = async (req, res) => {
  const badge = await Badge.findById(req.params.badgeId);
  if (!badge) return res.status(404).json({ message: "Badge not found" });
  res.json(resolveBadge(badge));
};

export const updateBadge = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const { badgeId } = req.params;
  const { name, description, category, color, isAutoAwarded, criteria, order, isActive } = req.body;

  const badge = await Badge.findById(badgeId);
  if (!badge) return res.status(404).json({ message: "Badge not found" });

  let imageBlobName = req.body.imageUrl;
  const previousImage = badge.imageUrl;
  if (req.file) {
    const uploaded = await uploadAttachment({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      scope: "lms-badge-images",
      parentId: badgeId,
    });
    imageBlobName = uploaded.blobName;
  }

  if (name && name !== badge.name) {
    const existingBadge = await Badge.findOne({ name });
    if (existingBadge && String(existingBadge._id) !== String(badgeId)) {
      return res.status(409).json({ message: "Badge with this name already exists" });
    }
  }

  badge.name = name || badge.name;
  badge.description = description || badge.description;
  badge.imageUrl = imageBlobName || badge.imageUrl;
  badge.category = category || badge.category;
  badge.color = color || badge.color;
  badge.isAutoAwarded = isAutoAwarded !== undefined ? isAutoAwarded : badge.isAutoAwarded;
  badge.criteria = criteria || badge.criteria;
  badge.order = order !== undefined ? order : badge.order;
  badge.isActive = isActive !== undefined ? isActive : badge.isActive;

  await badge.save();
  if (req.file && previousImage && previousImage !== badge.imageUrl) {
    deleteAttachments([previousImage]).catch((error) => console.error("Failed to delete replaced badge image:", error));
  }

  res.json({ message: "Badge updated successfully", badge: resolveBadge(badge) });
};

export const deleteBadge = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const badge = await Badge.findByIdAndDelete(req.params.badgeId);
  if (!badge) return res.status(404).json({ message: "Badge not found" });

  if (badge.imageUrl) deleteAttachments([badge.imageUrl]).catch((error) => console.error("Failed to delete badge image:", error));
  res.json({ message: "Badge deleted successfully", badge });
};
