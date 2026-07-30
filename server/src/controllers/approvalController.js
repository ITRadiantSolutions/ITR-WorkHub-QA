import User from "../models/User.js";
import { notifyUsers } from "../utils/notify.js";

const requireAdmin = (req, res) => {
  if (req.user.roles.tracker !== "ADMIN") {
    res.status(403).json({ message: "Admin access required" });
    return false;
  }
  return true;
};

export const getUserStatus = async (req, res) => {
  const email = decodeURIComponent(req.params.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ message: "Email is required" });

  const user = await User.findOne({ email }).select("approvalStatus").lean();
  if (!user) return res.status(404).json({ message: "User not found", status: "NotFound" });
  res.json({ status: user.approvalStatus });
};

export const listPendingUsers = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json(await User.find({ approvalStatus: "Pending" }).select("-password").sort({ createdAt: -1 }));
};

export const listRejectedUsers = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json(
    await User.find({ approvalStatus: "Rejected" })
      .select("-password")
      .populate("rejectedBy", "name")
      .sort({ rejectedAt: -1 }),
  );
};

export const listEditedUsers = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json(
    await User.find({ isEdited: true }).select("-password").populate("editedBy", "name").sort({ editedAt: -1 }),
  );
};

export const approveUser = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (user.approvalStatus !== "Pending") {
    return res.status(400).json({ message: "User not pending approval" });
  }

  user.approvalStatus = "Approved";
  user.approvedBy = req.user._id;
  user.approvedAt = new Date();
  user.isEdited = false;
  user.editedBy = null;
  user.editedAt = null;
  await user.save();

  await notifyUsers([user._id], {
    title: "Your account is approved",
    message: `Hello ${user.name}, your account has been approved by the admin.`,
    type: "userApproved",
    activityType: "update",
    performedBy: req.user._id,
  });

  const userData = user.toObject();
  delete userData.password;
  res.json({ message: "User approved successfully", user: userData });
};

export const rejectUser = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (user.approvalStatus !== "Pending") {
    return res.status(400).json({ message: "User not pending approval" });
  }

  user.approvalStatus = "Rejected";
  user.rejectedBy = req.user._id;
  user.rejectedAt = new Date();
  user.rejectionReason = req.body.reason || null;
  await user.save();

  await notifyUsers([user._id], {
    title: "Your account was rejected",
    message: `Hello ${user.name}, your account approval was rejected by the admin.`,
    type: "approvalUpdated",
    activityType: "update",
    performedBy: req.user._id,
    metadata: { previousStatus: "Pending", newStatus: "Rejected" },
  });

  res.json({ message: "User rejected successfully" });
};

export const reApproveUser = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (user.approvalStatus !== "Rejected") {
    return res.status(400).json({ message: "User must be rejected to re-approve" });
  }

  user.approvalStatus = "Approved";
  user.approvedBy = req.user._id;
  user.approvedAt = new Date();
  user.rejectedBy = null;
  user.rejectedAt = null;
  user.isEdited = false;
  user.editedBy = null;
  user.editedAt = null;
  await user.save();

  const userData = user.toObject();
  delete userData.password;
  res.json({ message: "User re-approved successfully", user: userData });
};

const VALID_TRACKER_ROLES = ["ADMIN", "PM", "DEVELOPER", "QA", "BUSINESS_USER"];

// Generic admin update of a user's name/email/tracker-role, with edit tracking
// (mirrors Flow_Tracker's original approvalController.updateUser).
export const updateUserAsAdmin = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, email, role } = req.body;

  if (role && !VALID_TRACKER_ROLES.includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  const hasChanges = (name && name !== user.name) || (email && email !== user.email) || (role && role !== user.roles.tracker);
  const previousRole = user.roles.tracker;

  if (hasChanges) {
    user.isEdited = true;
    user.editedBy = req.user._id;
    user.editedAt = new Date();
  }

  if (name) user.name = name;
  if (email) user.email = email.toLowerCase();
  if (role) user.roles.tracker = role;
  await user.save();

  if (role && role !== previousRole) {
    await notifyUsers([user._id], {
      title: "Your role has been updated",
      message: `Hello ${user.name}, your role was changed from ${previousRole} to ${role} by the admin.`,
      type: "userRoleChanged",
      activityType: "update",
      performedBy: req.user._id,
      metadata: { previousRole, newRole: role },
    });
  }

  const userData = user.toObject();
  delete userData.password;
  res.json({ message: "User updated successfully", user: userData });
};
