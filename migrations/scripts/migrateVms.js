// Migrates the standalone VMS QA database (separate Users/Visitors/Approvals/
// AuditLogs collections) into the unified ITR_One database's Visitor/Approval/
// ActivityLog collections + User.roles.vms, matching the schema built for the
// VMS port in server/src/models/{Visitor,Approval}.js.
//
// Read-only against the source — only .find() is ever called there. Dry-run
// by default: prints a report, writes nothing to the target either. Pass
// --commit to apply. Safe to re-run with --commit: every migrated doc gets a
// `_legacyId` ("vms:<oldId>") and is upserted on it, so re-running never
// creates duplicates. Users are upserted by email instead (can't collide with
// _legacyId since ItrOne users may already exist under other source systems).
//
// Status/role enums: the source used SCREAMING_CASE (e.g. "HOST_PENDING",
// "ADMIN"); the target schema lowercases them 1:1 ("host_pending", "admin"),
// so a plain .toLowerCase() is the correct mapping — no lookup table needed.

import "dotenv/config";
import { ObjectId } from "mongodb";
import { connect, normEmail } from "./lib/shared.js";

const COMMIT = process.argv.includes("--commit");

const upsertByLegacyId = async (targetDb, collectionName, docs) => {
  if (!COMMIT || !docs.length) return;
  const ops = docs.map((doc) => ({
    replaceOne: { filter: { _legacyId: doc._legacyId }, replacement: doc, upsert: true },
  }));
  await targetDb.collection(collectionName).bulkWrite(ops);
};

async function migrateVmsUsers({ vmsDb, targetDb, report }) {
  const vmsUsers = await vmsDb.collection("users").find({}).toArray();
  const userIdMap = new Map(); // old VMS user _id (string) -> target User _id (ObjectId)

  const existing = await targetDb.collection("users").find({}, { projection: { email: 1 } }).toArray();
  const existingIdByEmail = new Map(existing.map((u) => [normEmail(u.email), u._id]));

  const toCreate = [];
  for (const u of vmsUsers) {
    const email = normEmail(u.email);
    if (!email) continue;
    const vmsRole = (u.role || "HOST").toLowerCase();
    const existingId = existingIdByEmail.get(email);

    if (existingId) {
      // Already an ItrOne user (e.g. real @itradiant.com staff) — only grant
      // the VMS role, never touch their existing name/password/other roles.
      userIdMap.set(u._id.toString(), existingId);
      report.usersMatchedExisting += 1;
      if (COMMIT) {
        await targetDb.collection("users").updateOne({ _id: existingId }, { $set: { "roles.vms": vmsRole } });
      }
    } else {
      // No ItrOne account under this email — create one so Visitor/Approval
      // references resolve to something real, and so this person can
      // actually log in and use the VMS module going forward.
      const newId = new ObjectId();
      userIdMap.set(u._id.toString(), newId);
      toCreate.push({
        _id: newId,
        name: u.fullName || email,
        email,
        password: null, // VMS QA passwords are either bcrypt (different scheme) or an SSO placeholder — neither is safe/meaningful to carry over. They'll need Azure SSO or a password reset.
        authProvider: "local",
        azureAdId: null,
        managerId: null,
        shift: null,
        roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", vms: vmsRole },
        archived: { timesheet: false, pms: false, vms: false, account: false },
        approvalStatus: "Approved",
        approvedAt: u.createdAt || new Date(),
        approvedBy: null,
        rejectedBy: null,
        rejectedAt: null,
        createdAt: u.createdAt || new Date(),
      });
      report.usersCreated += 1;
    }
  }

  if (COMMIT && toCreate.length) {
    await targetDb.collection("users").insertMany(toCreate);
  }
  report.usersTotal = vmsUsers.length;
  return { userIdMap };
}

async function migrateVmsVisitors({ vmsDb, targetDb, userIdMap, report }) {
  const visitors = await vmsDb.collection("visitors").find({}).toArray();
  const visitorIdMap = new Map(); // old visitor _id (string) -> new Visitor _id (ObjectId)
  const docs = [];

  for (const v of visitors) {
    const newId = new ObjectId();
    visitorIdMap.set(v._id.toString(), newId);
    docs.push({
      _id: newId,
      _legacyId: `vms:${v._id}`,
      fullName: v.fullName,
      email: v.email || "",
      mobileNumber: v.mobileNumber,
      address: v.address || "",
      purpose: v.purpose || "",
      personToMeetId: v.personToMeetId ? userIdMap.get(v.personToMeetId.toString()) || null : null,
      expectedDuration: v.expectedDuration || "2 hours",
      visitorType: v.visitorType === "Invited" ? "Invited" : "Guest",
      notes: v.notes || "",
      photoUrl: v.photoUrl || "", // raw base64 data: URI — served as-is (see withPhotoUrl in vmsVisitorController.js)
      status: (v.status || "DRAFT").toLowerCase(),
      otpCode: v.otpCode || "",
      otpExpiresAt: v.otpExpiresAt || null,
      otpAttempts: v.otpAttempts || 0,
      visitDate: v.visitDate || null,
      escalatedReason: v.escalatedReason || "",
      approvedBy: v.approvedBy ? userIdMap.get(v.approvedBy.toString()) || null : null,
      checkInTime: v.checkInTime || null,
      checkOutTime: v.checkOutTime || null,
      createdById: v.createdById ? userIdMap.get(v.createdById.toString()) || null : null,
      createdAt: v.createdAt || new Date(),
      updatedAt: v.updatedAt || new Date(),
    });
  }

  await upsertByLegacyId(targetDb, "visitors", docs);
  report.visitorsTotal = docs.length;
  return { visitorIdMap };
}

async function migrateVmsApprovals({ vmsDb, targetDb, userIdMap, visitorIdMap, report }) {
  const approvals = await vmsDb.collection("approvals").find({}).toArray();
  const docs = approvals
    .map((a) => ({
      _legacyId: `vms:${a._id}`,
      visitorId: visitorIdMap.get(a.visitorId?.toString()) || null,
      approverId: a.approverId ? userIdMap.get(a.approverId.toString()) || null : null,
      role: (a.role || "host").toLowerCase(),
      status: (a.status || "PENDING").toLowerCase(),
      reason: a.reason || "",
      createdAt: a.createdAt || new Date(),
      updatedAt: a.updatedAt || new Date(),
    }))
    .filter((a) => a.visitorId); // drop any orphaned reference we couldn't resolve

  await upsertByLegacyId(targetDb, "approvals", docs);
  report.approvalsTotal = docs.length;
  report.approvalsSkipped = approvals.length - docs.length;
}

async function migrateVmsAuditLogs({ vmsDb, targetDb, userIdMap, visitorIdMap, report }) {
  const logs = await vmsDb.collection("auditlogs").find({}).toArray();
  const parseJson = (s) => {
    if (!s) return undefined;
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };

  const docs = logs.map((l) => ({
    _legacyId: `vms:${l._id}`,
    logType: "audit",
    type: "database",
    action: l.action,
    event: l.action,
    actorId: l.userId ? userIdMap.get(l.userId.toString()) || null : null,
    targetId: l.visitorId ? (visitorIdMap.get(l.visitorId.toString())?.toString() ?? l.visitorId.toString()) : undefined,
    ip: l.ipAddress || undefined,
    oldValue: parseJson(l.before),
    newValue: parseJson(l.after),
    createdAt: l.createdAt || new Date(),
    updatedAt: l.updatedAt || new Date(),
  }));

  await upsertByLegacyId(targetDb, "activity_logs", docs);
  report.auditLogsTotal = docs.length;
}

async function main() {
  const report = {
    usersTotal: 0,
    usersMatchedExisting: 0,
    usersCreated: 0,
    visitorsTotal: 0,
    approvalsTotal: 0,
    approvalsSkipped: 0,
    auditLogsTotal: 0,
  };

  const vms = await connect(process.env.VMS_MONGO_URI, process.env.VMS_DB_NAME || "test", "VMS QA");
  const target = await connect(process.env.TARGET_MONGO_URI, process.env.TARGET_DB_NAME || "itr_one", "target (ITR_One)");

  try {
    const ctx = { vmsDb: vms.db, targetDb: target.db, report };

    console.log("Migrating VMS users (role grants only / new accounts if unmatched)...");
    const { userIdMap } = await migrateVmsUsers(ctx);

    console.log("Migrating VMS visitors...");
    const { visitorIdMap } = await migrateVmsVisitors({ ...ctx, userIdMap });

    console.log("Migrating VMS approvals...");
    await migrateVmsApprovals({ ...ctx, userIdMap, visitorIdMap });

    console.log("Migrating VMS audit logs...");
    await migrateVmsAuditLogs({ ...ctx, userIdMap, visitorIdMap });

    console.log(JSON.stringify(report, null, 2));
    console.log(COMMIT ? "\nCommitted to target DB." : "\nDRY RUN — no writes performed (source was never written to either). Re-run with --commit to apply.");
  } finally {
    await vms.client.close();
    await target.client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
