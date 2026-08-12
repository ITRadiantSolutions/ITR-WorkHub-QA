import axios from "axios";
import User from "../models/User.js";
import { notifyUsers } from "../utils/notify.js";
import { getIO } from "../realtime/socket.js";
import { toPublicUser } from "../utils/publicUser.js";
import { getGraphAccessToken } from "../utils/graphMailer.js";
import { writeAuditLog } from "../utils/activityLog.js";

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

// The HRMS "Manage" page lets an hrms "manager" grant/revoke module access
// for their own direct reports too, but capped below each module's top
// tier (ADMIN/admin/hr) — only HR can hand out that level of access.
const MANAGER_ROLE_CEILING = {
  timesheet: ["employee", "manager"],
  pms: ["employee", "manager"],
  tracker: ["BUSINESS_USER", "DEVELOPER", "QA", "PM"],
  vms: ["host", "receptionist"],
  lms: ["employee", "manager"],
  hrms: ["employee", "manager"],
};

// A super admin bypasses every gate below, including the ones that would
// otherwise apply to "hr"-tier users (e.g. the MANAGER_ROLE_CEILING check).
const isFullAccess = (actor) => actor.isSuperAdmin || isAdminOrHr(actor);

// Gates ONLY assignRole/setArchived — i.e. "who can edit module access/
// roles" (the HRMS Manage page, Employees page role dropdown, ModuleRolesPanel).
// Deliberately does NOT affect HR's other duties (referrals, job posts,
// employee profile fields, Azure sync, etc.) — those stay on isAdminOrHr.
// Holding "hr" or "manager" no longer implies edit rights here on its own;
// a super admin has to explicitly grant the specific module via
// User.manageAccessModules — granting PMS doesn't imply FlowTrack, etc.
const canEditAccess = async (actor, targetUserId, module) => {
  if (actor.isSuperAdmin) return true;
  if (!actor.manageAccessModules?.includes(module)) return false;
  if (isAdminOrHr(actor)) return true;
  if (actor.roles.hrms !== "manager") return false;
  const target = await User.findById(targetUserId).select("managerId");
  return Boolean(target?.managerId?.equals(actor._id));
};

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
  const { module, role } = req.body;
  if (!(await canEditAccess(req.user, req.params.id, module))) {
    return res.status(403).json({ message: "You don't have permission to manage access. Ask a super admin to grant it." });
  }
  if (!MODULE_ROLE_ENUM[module]?.includes(role)) {
    return res.status(400).json({ message: `Invalid role '${role}' for module '${module}'` });
  }
  if (!isFullAccess(req.user) && !MANAGER_ROLE_CEILING[module]?.includes(role)) {
    return res.status(403).json({ message: `Managers cannot assign '${role}' for '${module}'` });
  }
  const before = await User.findById(req.params.id).select("roles name email");
  if (!before) return res.status(404).json({ message: "User not found" });
  const previousRole = before.roles?.[module];
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { $set: { [`roles.${module}`]: role } },
    { new: true },
  ).select("-password");

  writeAuditLog({
    type: "change",
    event: "user.role.updated",
    action: "user.role.updated",
    actorId: req.user._id,
    actorName: req.user.name,
    actorEmail: req.user.email,
    targetId: user._id,
    oldValue: { module, role: previousRole },
    newValue: { module, role },
    changes: { [`roles.${module}`]: role },
    metadata: { targetName: user.name, targetEmail: user.email, module },
  });

  res.json(user);
};

export const setArchived = async (req, res) => {
  const { module, archived } = req.body; // module: "timesheet" | "pms" | "vms" | "lms" | "hrms" | "account"
  if (!(await canEditAccess(req.user, req.params.id, module))) {
    return res.status(403).json({ message: "You don't have permission to manage access. Ask a super admin to grant it." });
  }
  const validModules = isFullAccess(req.user)
    ? ["timesheet", "pms", "vms", "lms", "hrms", "account"]
    : ["timesheet", "pms", "vms", "lms", "hrms"]; // "account" (full deactivation) is HR/admin-only
  if (!validModules.includes(module)) {
    return res.status(400).json({ message: "Invalid module" });
  }
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { $set: { [`archived.${module}`]: Boolean(archived) } },
    { new: true },
  ).select("-password");
  if (!user) return res.status(404).json({ message: "User not found" });

  writeAuditLog({
    type: "change",
    event: "user.archive.updated",
    action: "user.archive.updated",
    actorId: req.user._id,
    actorName: req.user.name,
    actorEmail: req.user.email,
    targetId: user._id,
    oldValue: { module, archived: !archived },
    newValue: { module, archived: Boolean(archived) },
    changes: { [`archived.${module}`]: Boolean(archived) },
    metadata: { targetName: user.name, targetEmail: user.email, module },
  });

  res.json(user);
};

// Super admin only — hands the "manage access" capability (assignRole/
// setArchived, i.e. the HRMS Manage page) to a specific person, per module,
// instead of it being automatic for every "hr"/"manager" tier holder or
// all-or-nothing. Replaces the full list each call — the client sends the
// complete set of modules this person should have after the change. There's
// no equivalent endpoint for isSuperAdmin itself — that's only ever set by a
// direct, deliberate action, never through a normal API call.
export const setManageAccessGrant = async (req, res) => {
  if (!req.user.isSuperAdmin) {
    return res.status(403).json({ message: "Only a super admin can grant or revoke manage-access." });
  }
  const modules = Array.isArray(req.body.modules) ? [...new Set(req.body.modules)] : [];
  if (modules.some((m) => !MODULE_ROLE_ENUM[m])) {
    return res.status(400).json({ message: "Invalid module in list" });
  }
  const before = await User.findById(req.params.id).select("manageAccessModules name email");
  if (!before) return res.status(404).json({ message: "User not found" });
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { $set: { manageAccessModules: modules } },
    { new: true },
  ).select("-password");

  writeAuditLog({
    type: "change",
    event: "user.manageAccessGrant.updated",
    action: "user.manageAccessGrant.updated",
    actorId: req.user._id,
    actorName: req.user.name,
    actorEmail: req.user.email,
    targetId: user._id,
    oldValue: { modules: before.manageAccessModules || [] },
    newValue: { modules: modules },
    changes: { modules },
    metadata: { targetName: user.name, targetEmail: user.email },
  });

  res.json(user);
};

// Super admin only — flips isSuperAdmin on another account. Deliberately
// guarded beyond a plain role check: this bypasses every other permission
// gate in the app, so (1) only an existing super admin can grant/revoke it,
// and (2) revoking is refused if it would leave zero super admins — there
// must always be at least one person able to fix access if something goes
// wrong. Every change is written to the audit log (surfaced on Access
// Grants' Audit Logs tab).
// Permanently protected super admin — a deliberate, hardcoded exemption
// (not just the "last super admin" rule) so this specific account can never
// be locked out of Access Grants, even while other super admins exist.
const PROTECTED_SUPER_ADMIN_EMAIL = "pulkit.bopche@itradiant.com";

export const setSuperAdmin = async (req, res) => {
  if (!req.user.isSuperAdmin) {
    return res.status(403).json({ message: "Only a super admin can grant or revoke super admin." });
  }
  const nextValue = Boolean(req.body.isSuperAdmin);
  const target = await User.findById(req.params.id).select("isSuperAdmin name email");
  if (!target) return res.status(404).json({ message: "User not found" });

  if (target.isSuperAdmin === nextValue) {
    return res.json(await User.findById(target._id).select("-password"));
  }

  if (!nextValue && target.email?.toLowerCase() === PROTECTED_SUPER_ADMIN_EMAIL) {
    return res.status(400).json({ message: "This super admin is protected and can't be removed." });
  }

  if (!nextValue) {
    const remaining = await User.countDocuments({ isSuperAdmin: true, _id: { $ne: target._id } });
    if (remaining === 0) {
      return res.status(400).json({ message: "Can't remove the last super admin — grant it to someone else first." });
    }
  }

  const user = await User.findByIdAndUpdate(
    target._id,
    { $set: { isSuperAdmin: nextValue } },
    { new: true },
  ).select("-password");

  writeAuditLog({
    type: "change",
    event: nextValue ? "user.superAdmin.granted" : "user.superAdmin.revoked",
    action: nextValue ? "user.superAdmin.granted" : "user.superAdmin.revoked",
    actorId: req.user._id,
    actorName: req.user.name,
    actorEmail: req.user.email,
    targetId: user._id,
    oldValue: { isSuperAdmin: target.isSuperAdmin },
    newValue: { isSuperAdmin: nextValue },
    changes: { isSuperAdmin: nextValue },
    metadata: { targetName: user.name, targetEmail: user.email },
  });

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
  const managerEmailByEmail = new Map();
  let newAdded = 0;

  // One extra Graph call per member — GET /users/{id}/manager doesn't support
  // $expand from the group members list, so it has to be fetched separately.
  // A 404 just means Azure AD has no manager set for that user (e.g. the top
  // of the org chart), not a real failure.
  const fetchManagerInfo = async (azureUserId) => {
    try {
      const { data } = await axios.get(
        `https://graph.microsoft.com/v1.0/users/${azureUserId}/manager?$select=mail,userPrincipalName,displayName`,
        { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15_000 },
      );
      const email = (data.mail || data.userPrincipalName || "").toLowerCase() || null;
      return { email, name: data.displayName || "" };
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error(`runAzureGroupSync: failed to fetch manager for ${azureUserId}`, err.response?.data || err.message);
      }
      return { email: null, name: "" };
    }
  };

  for (const groupId of groupIds) {
    let members = [];
    try {
      // Real Microsoft Graph user properties — the previous $select list
      // included several names (_id, azureAdId, joinDate, designation) that
      // don't exist on the Graph user resource, which Graph rejects with a
      // 400 for the whole request (silently skipping every member of every
      // group, since that error was swallowed by the catch below).
      const { data } = await axios.get(
        `https://graph.microsoft.com/v1.0/groups/${groupId}/members?$select=id,displayName,mail,userPrincipalName,department,jobTitle,employeeId,employeeHireDate,accountEnabled`,
        { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15_000 },
      );
      members = data.value || [];
      // console.log(`runAzureGroupSync: fetched ${members.length} members from group ${groupId}`);
    } catch (err) {
      console.error(`runAzureGroupSync: failed to fetch group ${groupId}`, err.response?.data || err.message);
      continue; // one bad group shouldn't abort the whole sync
    }

    for (const member of members) {
      const email = (member.mail || member.userPrincipalName || "").toLowerCase();
      const name = member.displayName || email;
      const azureAdId = member.id || null;
      const department = member.department || "";
      const designation = member.jobTitle || "";
      const employeeId = member.employeeId || "";
      const joiningDate = member.employeeHireDate ? new Date(member.employeeHireDate) : null;
      const employmentStatus = member.accountEnabled === false ? "terminated" : "active";
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);

      let managerName = "";
      if (azureAdId) {
        const managerInfo = await fetchManagerInfo(azureAdId);
        managerName = managerInfo.name;
        if (managerInfo.email && managerInfo.email !== email) managerEmailByEmail.set(email, managerInfo.email);
      }

      const existing = await User.findOne({ email }).select("-password");
      if (existing) {
        // Backfill profile fields Azure knows about but the local record
        // doesn't yet — never overwrite a value an admin already set.
        let changed = false;
        if (!existing.department && department) {
          existing.department = department;
          changed = true;
        }
        if (!existing.designation && designation) {
          existing.designation = designation;
          changed = true;
        }
        if (!existing.employeeId && employeeId) {
          existing.employeeId = employeeId;
          changed = true;
        }
        if (!existing.azureAdId && azureAdId) {
          existing.azureAdId = azureAdId;
          changed = true;
        }
        if (!existing.joiningDate && joiningDate) {
          existing.joiningDate = joiningDate;
          changed = true;
        }
        if (!existing.managerName && managerName) {
          existing.managerName = managerName;
          changed = true;
        }
        if (changed) await existing.save();

        synced.push(existing);
        continue;
      }

      const created = await User.create({
        name,
        email,
        azureAdId,
        employeeId,
        department,
        designation,
        employmentStatus,
        joiningDate,
        managerName,
        authProvider: "azure",
        roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", vms: "host", lms: "employee", hrms: "employee" },
        approvalStatus: "Approved",
        approvedAt: new Date(),
      });
      synced.push(created);
      newAdded += 1;
    }
  }

  // Resolve reporting lines from Azure AD's manager relationship, now that
  // every synced user (and any pre-existing manager not in these groups)
  // exists locally. Only fills in a blank managerId — never overwrites one
  // HR already set by hand via the Employees screen.
  for (const [email, managerEmail] of managerEmailByEmail) {
    const report = await User.findOne({ email, managerId: null });
    if (!report) continue;
    const manager = await User.findOne({ email: managerEmail }).select("_id");
    if (!manager) continue;
    report.managerId = manager._id;
    await report.save();
  }

  return { skipped: false, message: `Group sync complete. New users: ${newAdded}`, totalUsers: synced.length, newAdded, users: synced };
}

export const syncUsersFromAzureGroups = async (req, res) => {
  if (!isAdminOrHr(req.user)) return res.status(403).json({ message: "Admin/HR access required" });

  const result = await runAzureGroupSync();
  if (result.skipped) return res.status(400).json({ message: result.message });
  res.json(result);
};
