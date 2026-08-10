import axios from "axios";
import User from "../models/User.js";
import { notifyUsers } from "../utils/notify.js";
import { getIO } from "../realtime/socket.js";
import { toPublicUser } from "../utils/publicUser.js";
import { getGraphAccessToken } from "../utils/graphMailer.js";

const MODULE_ROLE_ENUM = {
  timesheet: ["employee", "manager", "hr"],
  pms: ["employee", "manager", "hr"],
  tracker: ["ADMIN", "PM", "DEVELOPER", "QA", "BUSINESS_USER"],
  vms: ["host", "receptionist", "admin"],
  lms: ["employee", "manager", "admin"],
  hrms: ["employee", "manager", "hr"],
};

// "HR-only" in the old Flow_Tracker system: our unified model splits HR into
// per-module roles rather than one tracker role, so treat tracker ADMIN or
// any module's "hr" role as equivalent admin/HR authority.
const isAdminOrHr = (user) =>
  user.roles.tracker === "ADMIN" ||
  user.roles.timesheet === "hr" ||
  user.roles.pms === "hr" ||
  user.roles.hrms === "hr";

// List all users — used for assignee/team dropdowns across the tracker UI,
// not scoped to a manager's direct reports (see getMyReports for that).
// Optional ?archived=true|false scoped to ?module=timesheet|pms|account (default
// "account") lets HR screens show just their active roster or just the
// archived-from-this-module list, without changing the default unfiltered call.
export const listUsers = async (req, res) => {
  const canViewAll = isAdminOrHr(req.user) || ["PM", "DEVELOPER", "QA"].includes(req.user.roles.tracker);
  if (!canViewAll) return res.status(403).json({ message: "Insufficient permissions to view users" });

  const filter = {};
  if (req.query.archived === "true" || req.query.archived === "false") {
    const module = ["timesheet", "pms", "account"].includes(req.query.module) ? req.query.module : "account";
    filter[`archived.${module}`] = req.query.archived === "true";
  }

  const users = await User.find(filter).select("-password");
  // EmployeePage.jsx's Approved tab reads `.createdAt` for the signup-date
  // column, so add the flat `.role` (Flow_Tracker convention, see
  // utils/publicUser.js) alongside the full doc instead of swapping in
  // toPublicUser(), which would silently drop createdAt/updatedAt.
  res.json(users.map((u) => ({ ...u.toObject(), role: u.roles.tracker })));
};

export const getMe = async (req, res) => {
  res.json({ user: toPublicUser(req.user) });
};

export const createUser = async (req, res) => {
  if (!isAdminOrHr(req.user)) return res.status(403).json({ message: "Admin/HR access required" });
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email and password are required" });
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    roles: { timesheet: "employee", pms: "employee", tracker: role || "BUSINESS_USER" },
    approvalStatus: "Approved",
    approvedBy: req.user._id,
    approvedAt: new Date(),
  });

  const userData = user.toObject();
  delete userData.password;
  userData.role = user.roles.tracker;
  res.status(201).json(userData);
};

// Generic admin/HR update of name/email/tracker-role/password, with edit tracking.
export const updateUserGeneric = async (req, res) => {
  if (!isAdminOrHr(req.user)) return res.status(403).json({ message: "Admin/HR access required" });
  const { name, email, role, password } = req.body;

  if (role && !MODULE_ROLE_ENUM.tracker.includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  const previousRole = user.roles.tracker;
  const hasChanges = (name && name !== user.name) || (email && email !== user.email) || (role && role !== previousRole);
  if (hasChanges) {
    user.isEdited = true;
    user.editedBy = req.user._id;
    user.editedAt = new Date();
  }

  if (name) user.name = name;
  if (email) user.email = email.toLowerCase();
  if (role) user.roles.tracker = role;
  if (password) user.password = password;
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
    getIO()?.to(`user_${user._id}`).emit("user:role-changed", { userId: user._id.toString(), previousRole, newRole: role });
  }

  const userData = user.toObject();
  delete userData.password;
  userData.role = user.roles.tracker;
  res.json({ message: "User updated successfully", user: userData });
};

export const deleteUser = async (req, res) => {
  if (!isAdminOrHr(req.user)) return res.status(403).json({ message: "Admin/HR access required" });
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ message: "User deleted" });
};

export const getMyReports = async (req, res) => {
  const users = await User.find({ managerId: req.user._id }).select("-password");
  // `report_ids` alongside the full list — ITR_TimeFlow_Production's PMS
  // UserKraSearch.jsx only reads that field from this same endpoint path.
  res.json({ data: users, report_ids: users.map((u) => u._id.toString()) });
};

export const listManagers = async (req, res) => {
  const module = req.query.module === "pms" ? "pms" : "timesheet";
  const users = await User.find({ [`roles.${module}`]: "manager" }).select("name email");
  res.json(users);
};

export const assignRole = async (req, res) => {
  if (!isAdminOrHr(req.user)) return res.status(403).json({ message: "Admin/HR access required" });
  const { module, role } = req.body;
  if (!MODULE_ROLE_ENUM[module]?.includes(role)) {
    return res.status(400).json({ message: `Invalid role '${role}' for module '${module}'` });
  }
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { $set: { [`roles.${module}`]: role } },
    { new: true },
  ).select("-password");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
};

export const setArchived = async (req, res) => {
  if (!isAdminOrHr(req.user)) return res.status(403).json({ message: "Admin/HR access required" });
  const { module, archived } = req.body; // module: "timesheet" | "pms" | "hrms" | "account"
  if (!["timesheet", "pms", "hrms", "account"].includes(module)) {
    return res.status(400).json({ message: "Invalid module" });
  }
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { $set: { [`archived.${module}`]: Boolean(archived) } },
    { new: true },
  ).select("-password");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
};

export const setManager = async (req, res) => {
  if (!isAdminOrHr(req.user)) return res.status(403).json({ message: "Admin/HR access required" });
  // Accept both our own { managerId } and the PMS UserKraSearch.jsx { manager_id } shape.
  const managerId = req.body.managerId ?? req.body.manager_id;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { $set: { managerId: managerId || null } },
    { new: true },
  ).select("-password");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
};

export const bulkAssignManager = async (req, res) => {
  if (!isAdminOrHr(req.user)) return res.status(403).json({ message: "Admin/HR access required" });
  const userIds = req.body.userIds ?? req.body.user_ids;
  const managerId = req.body.managerId ?? req.body.manager_id;
  if (!Array.isArray(userIds) || !userIds.length) {
    return res.status(400).json({ message: "userIds must be a non-empty array" });
  }
  await User.updateMany({ _id: { $in: userIds } }, { $set: { managerId: managerId || null } });
  res.json({ updated: userIds.length });
};

// Legacy PMS compat: POST /assign-pms-role/ { user, role }
export const assignPmsRoleLegacy = async (req, res) => {
  if (!isAdminOrHr(req.user)) return res.status(403).json({ message: "Admin/HR access required" });
  const { user: userId, role } = req.body;
  if (!MODULE_ROLE_ENUM.pms.includes(role)) {
    return res.status(400).json({ message: `Invalid PMS role '${role}'` });
  }
  const user = await User.findByIdAndUpdate(userId, { $set: { "roles.pms": role } }, { new: true }).select(
    "-password",
  );
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
};

// Legacy PMS compat: PATCH /pms/users/:id/archive { is_archived }
export const archivePmsUserLegacy = async (req, res) => {
  if (!isAdminOrHr(req.user)) return res.status(403).json({ message: "Admin/HR access required" });
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { $set: { "archived.pms": Boolean(req.body.is_archived) } },
    { new: true },
  ).select("-password");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
};

// Shift assignment is one notch broader than the rest of this file's
// Admin/HR-only actions — a timesheet manager can assign shifts for their
// own team too (matches Manage.jsx's Assign Shifts UI, which is shown to
// managers, not just HR).
const canAssignShift = (user) => isAdminOrHr(user) || user.roles.timesheet === "manager";

export const setShift = async (req, res) => {
  if (!canAssignShift(req.user)) return res.status(403).json({ message: "Manager or Admin/HR access required" });
  const { shift } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { shift } }, { new: true }).select(
    "-password",
  );
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
};

// Bulk-provision users from one or more Azure AD group memberships — ported
// from routes.py's /users/sync. Configure AZURE_SYNC_GROUP_IDS as a
// comma-separated list of AAD group object IDs; each group's members are
// fetched via Graph (app-only auth, same credentials graphMailer.js already
// uses) and any member without a matching local account is created with
// default employee roles. Existing accounts are left untouched.
// Shared by the HTTP route below and the daily cron job in jobs/azureUserSync.js.
export async function runAzureGroupSync() {
  const groupIds = (process.env.AZURE_SYNC_GROUP_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!groupIds.length) {
    return { skipped: true, message: "No Azure AD groups configured — set AZURE_SYNC_GROUP_IDS on the server." };
  }

  const accessToken = await getGraphAccessToken();
  const seenEmails = new Set();
  const synced = [];
  let newAdded = 0;

  for (const groupId of groupIds) {
    let members = [];
    try {
      const { data } = await axios.get(
        `https://graph.microsoft.com/v1.0/groups/${groupId}/members?$select=displayName,mail,userPrincipalName`,
        { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15_000 },
      );
      members = data.value || [];
    } catch (err) {
      console.error(`runAzureGroupSync: failed to fetch group ${groupId}`, err.response?.data || err.message);
      continue; // one bad group shouldn't abort the whole sync
    }

    for (const member of members) {
      const email = (member.mail || member.userPrincipalName || "").toLowerCase();
      const name = member.displayName || email;
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);

      const existing = await User.findOne({ email }).select("-password");
      if (existing) {
        synced.push(existing);
        continue;
      }

      const created = await User.create({
        name,
        email,
        authProvider: "azure",
        roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER" },
        approvalStatus: "Approved",
        approvedAt: new Date(),
      });
      synced.push(created);
      newAdded += 1;
    }
  }

  return { skipped: false, message: `Group sync complete. New users: ${newAdded}`, totalUsers: synced.length, newAdded, users: synced };
}

export const syncUsersFromAzureGroups = async (req, res) => {
  if (!isAdminOrHr(req.user)) return res.status(403).json({ message: "Admin/HR access required" });

  const result = await runAzureGroupSync();
  if (result.skipped) return res.status(400).json({ message: result.message });
  res.json(result);
};
