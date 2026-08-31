import AssetAssignment from "../models/AssetAssignment.js";
import Asset from "../models/Asset.js";
import User from "../models/User.js";
import { writeAuditLog } from "../utils/activityLog.js";
import { notifyUsers } from "../utils/notify.js";
import { sendHrmsEmail } from "../utils/hrmsMailer.js";

const populateAssignment = (query) =>
  query.populate("asset").populate("employee", "name email").populate("assignedBy", "name email");

export const assignAsset = async (req, res) => {
  const { assetId, employeeId } = req.body;
  if (!assetId || !employeeId) return res.status(400).json({ message: "assetId and employeeId are required" });

  const employee = await User.findById(employeeId).select("name email");
  if (!employee) return res.status(404).json({ message: "Employee not found" });

  // Checking asset.status and then writing "assigned" as two separate steps
  // let two near-simultaneous assignments (two HR admins on the same asset
  // queue, or a double-click) both read "available" before either write
  // landed, creating two active assignments for one physical asset. The
  // condition and the write need to be the same atomic operation.
  const asset = await Asset.findOneAndUpdate(
    { _id: assetId, status: "available" },
    { $set: { status: "assigned" } },
    { new: true },
  );
  if (!asset) {
    const existing = await Asset.findById(assetId).select("status");
    if (!existing) return res.status(404).json({ message: "Asset not found" });
    return res.status(409).json({ message: `Asset is currently '${existing.status}', not available` });
  }

  const assignment = await AssetAssignment.create({ asset: assetId, employee: employeeId, assignedBy: req.user._id });

  writeAuditLog({
    type: "database", event: "hrms.asset.assigned", action: "hrms.asset.assigned",
    actorId: req.user._id, targetId: assignment._id, oldValue: null, newValue: { asset: assetId, employee: employeeId },
  });
  notifyUsers([employeeId], {
    title: "Asset assigned",
    message: `${asset.name} (${asset.assetTag}) has been assigned to you.`,
    type: "assetAssigned",
    activityType: "create",
    performedBy: req.user._id,
  });
  sendHrmsEmail(
    employee.email, "An asset has been assigned to you", "Asset assigned",
    `<p>Hi ${employee.name}, <strong>${asset.name}</strong> (${asset.assetTag}) has been assigned to you.</p>`,
  );

  res.status(201).json(await populateAssignment(AssetAssignment.findById(assignment._id)));
};

export const returnAsset = async (req, res) => {
  const assignment = await AssetAssignment.findById(req.params.id).populate("asset");
  if (!assignment) return res.status(404).json({ message: "Assignment not found" });
  if (assignment.status === "returned") return res.status(409).json({ message: "This asset was already returned" });

  const { returnCondition, returnNotes } = req.body;
  assignment.status = "returned";
  assignment.returnedAt = new Date();
  assignment.returnCondition = returnCondition || assignment.asset.condition;
  assignment.returnNotes = returnNotes?.trim() || "";
  await assignment.save();

  const asset = await Asset.findById(assignment.asset._id);
  asset.status = "available";
  asset.condition = assignment.returnCondition;
  await asset.save();

  writeAuditLog({
    type: "database", event: "hrms.asset.returned", action: "hrms.asset.returned",
    actorId: req.user._id, targetId: assignment._id, oldValue: { status: "active" }, newValue: { status: "returned" },
  });
  res.json(await populateAssignment(AssetAssignment.findById(assignment._id)));
};

export const listMyAssets = async (req, res) => {
  const assignments = await populateAssignment(AssetAssignment.find({ employee: req.user._id, status: "active" })).sort({ assignedAt: -1 });
  res.json(assignments);
};

export const listAssetAssignments = async (req, res) => {
  const filter = {};
  if (req.query.employee?.trim()) filter.employee = req.query.employee.trim();
  if (req.query.status?.trim()) filter.status = req.query.status.trim();
  const assignments = await populateAssignment(AssetAssignment.find(filter)).sort({ assignedAt: -1 });
  res.json(assignments);
};
