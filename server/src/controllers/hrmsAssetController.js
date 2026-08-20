import Asset, { ASSET_CATEGORIES } from "../models/Asset.js";
import { writeAuditLog } from "../utils/activityLog.js";

const FIELDS = ["assetTag", "name", "category", "serialNumber", "condition", "purchaseDate", "notes"];

export const listAssets = async (req, res) => {
  const filter = {};
  if (req.query.status?.trim()) filter.status = req.query.status.trim();
  if (req.query.category?.trim()) filter.category = req.query.category.trim();
  const assets = await Asset.find(filter).sort({ createdAt: -1 });
  res.json(assets);
};

export const createAsset = async (req, res) => {
  if (!req.body.assetTag?.trim()) return res.status(400).json({ message: "assetTag is required" });
  if (!req.body.name?.trim()) return res.status(400).json({ message: "name is required" });
  if (!ASSET_CATEGORIES.includes(req.body.category)) {
    return res.status(400).json({ message: `category must be one of: ${ASSET_CATEGORIES.join(", ")}` });
  }

  const payload = {};
  for (const field of FIELDS) {
    if (req.body[field] !== undefined) payload[field] = req.body[field];
  }

  let asset;
  try {
    asset = await Asset.create({ ...payload, createdBy: req.user._id });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "An asset with this tag already exists" });
    throw error;
  }

  writeAuditLog({
    type: "database", event: "hrms.asset.created", action: "hrms.asset.created",
    actorId: req.user._id, targetId: asset._id, oldValue: null, newValue: { assetTag: asset.assetTag },
  });
  res.status(201).json(asset);
};

export const updateAsset = async (req, res) => {
  const asset = await Asset.findById(req.params.id);
  if (!asset) return res.status(404).json({ message: "Asset not found" });

  const oldValue = {};
  const newValue = {};
  for (const field of FIELDS) {
    if (req.body[field] === undefined) continue;
    oldValue[field] = asset[field];
    asset[field] = req.body[field];
    newValue[field] = req.body[field];
  }

  try {
    await asset.save();
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "An asset with this tag already exists" });
    throw error;
  }

  writeAuditLog({
    type: "database", event: "hrms.asset.updated", action: "hrms.asset.updated",
    actorId: req.user._id, targetId: asset._id, oldValue, newValue,
  });
  res.json(asset);
};

// Only toggles between available/retired — "assigned" is set exclusively by
// assignAsset/returnAsset in hrmsAssetAssignmentController.js.
export const setAssetStatus = async (req, res) => {
  const asset = await Asset.findById(req.params.id);
  if (!asset) return res.status(404).json({ message: "Asset not found" });
  if (asset.status === "assigned") {
    return res.status(409).json({ message: "Return this asset before changing its status" });
  }
  if (!["available", "retired"].includes(req.body.status)) {
    return res.status(400).json({ message: "status must be 'available' or 'retired'" });
  }

  const oldStatus = asset.status;
  asset.status = req.body.status;
  await asset.save();

  writeAuditLog({
    type: "database", event: "hrms.asset.statusChanged", action: "hrms.asset.statusChanged",
    actorId: req.user._id, targetId: asset._id, oldValue: { status: oldStatus }, newValue: { status: asset.status },
  });
  res.json(asset);
};
