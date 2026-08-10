import Visitor, { VISIT_STATUS } from "../models/Visitor.js";
import ActivityLog from "../models/ActivityLog.js";
import User from "../models/User.js";

const requireVmsAdmin = (req, res) => {
  if (req.user.roles.vms !== "admin") {
    res.status(403).json({ error: "VMS Admin access required" });
    return false;
  }
  return true;
};

export async function analytics(req, res) {
  if (!requireVmsAdmin(req, res)) return;
  const [totalVisitors, pending, approved, checkedIn] = await Promise.all([
    Visitor.countDocuments(),
    Visitor.countDocuments({ status: VISIT_STATUS.OTP_PENDING }),
    Visitor.countDocuments({ status: VISIT_STATUS.FINAL_APPROVED }),
    Visitor.countDocuments({ status: VISIT_STATUS.CHECKED_IN }),
  ]);
  return res.json({ totalVisitors, pending, approved, checkedIn });
}

export async function auditLogs(req, res) {
  if (!requireVmsAdmin(req, res)) return;
  const limit = Math.min(Number(req.query.limit) || 10, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const filter = { logType: "audit", type: "database", targetId: { $exists: true } };
  const [total, logs] = await Promise.all([
    ActivityLog.countDocuments(filter),
    ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate("actorId", "name email")
      .lean(),
  ]);

  return res.json({ logs, total, limit, offset });
}

// Public endpoint for the Visitor Kiosk's "who are you visiting" dropdown —
// safe fields only, no auth (the kiosk itself isn't logged in).
export async function listUsersForKiosk(req, res) {
  const users = await User.find({ "archived.vms": { $ne: true }, "archived.account": { $ne: true } })
    .select("name email")
    .sort({ name: 1 })
    .lean();
  return res.json({ users });
}

export async function updateUserVmsRole(req, res) {
  if (!requireVmsAdmin(req, res)) return;
  const { id } = req.params;
  const { role } = req.body;
  if (!["admin", "receptionist", "host"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  const updated = await User.findByIdAndUpdate(id, { "roles.vms": role }, { new: true }).select("-password").lean();
  if (!updated) return res.status(404).json({ error: "User not found" });
  return res.json({ user: updated });
}
