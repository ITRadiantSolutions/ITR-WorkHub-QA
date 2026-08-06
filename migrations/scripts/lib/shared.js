import { MongoClient, ObjectId } from "mongodb";

export const normEmail = (email) => (email || "").trim().toLowerCase();
export const normName = (name) => (name || "").trim().toLowerCase();

export async function connect(uri, dbName, label) {
  if (!uri) throw new Error(`Missing Mongo URI for ${label} (check migrations/.env)`);
  const client = new MongoClient(uri);
  await client.connect();
  return { client, db: client.db(dbName) };
}

export async function migrateUsers({ timeflowDb, flowtrackerDb, targetDb, report, commit }) {
  const userIdMap = new Map(); // "timeflow:<oldId>" | "flowtracker:<oldId>" -> new ObjectId
  const byEmail = new Map(); // normalized email -> merged unified user doc (with _id already assigned)

  // Re-running must reuse whatever _id an already-migrated user has in the
  // target — replaceOne rejects changing an existing doc's _id, and a fresh
  // ObjectId per run would also silently break every other collection's
  // userId references across re-runs.
  const existingUsers = await targetDb.collection("users").find({}, { projection: { email: 1 } }).toArray();
  const existingIdByEmail = new Map(existingUsers.map((u) => [normEmail(u.email), u._id]));

  const timeflowUsers = await timeflowDb.collection("users").find({}).toArray();
  const flowtrackerUsers = await flowtrackerDb.collection("users").find({}).toArray();

  for (const tf of timeflowUsers) {
    const email = normEmail(tf.email);
    if (!email) continue;
    const profile = tf.profile || {};
    byEmail.set(email, {
      _id: existingIdByEmail.get(email) || new ObjectId(),
      name: tf.username || tf.name || email,
      email,
      password: tf.hashed_password || tf.password || null,
      authProvider: "local",
      azureAdId: null,
      managerId: null,
      shift: profile.shift ?? null,
      roles: {
        timesheet: tf.role || profile.role || "employee",
        pms: tf.pms_role || profile.pms_role || "employee",
        tracker: "BUSINESS_USER",
      },
      archived: {
        timesheet: Boolean(tf.timeflow_archived ?? profile.timeflow_archived),
        pms: Boolean(tf.pms_archived ?? profile.pms_archived),
        account: Boolean(tf.is_archived),
      },
      approvalStatus: "Approved",
      approvedAt: tf.createdAt || new Date(),
      approvedBy: null,
      rejectedBy: null,
      rejectedAt: null,
      createdAt: tf._id?.getTimestamp?.() || new Date(),
      _sources: { timeflowId: tf._id?.toString(), timeflowManagerId: tf.manager_id || null },
    });
    report.usersFromTimeflow += 1;
  }

  for (const ft of flowtrackerUsers) {
    const email = normEmail(ft.email);
    if (!email) continue;
    const existing = byEmail.get(email);
    if (existing) {
      existing.roles.tracker = ft.role || "BUSINESS_USER";
      existing.approvalStatus = ft.approvalStatus === "Rejected" ? "Rejected" : existing.approvalStatus;
      existing.approvedBy = existing.approvedBy || ft.approvedBy || null;
      existing.rejectedBy = ft.rejectedBy || null;
      existing.rejectedAt = ft.rejectedAt || null;
      existing.password = existing.password || ft.password || null;
      existing.editedBy = ft.editedBy || null;
      existing.editedAt = ft.editedAt || null;
      existing.isEdited = Boolean(ft.isEdited);
      existing._sources.flowtrackerId = ft._id?.toString();
      if (existing.name === email && ft.name) existing.name = ft.name;
      report.usersMerged += 1;
      if (ft.name && existing.name !== ft.name) {
        report.nameMismatches.push({ email, timeflowName: existing.name, flowtrackerName: ft.name });
      }
    } else {
      byEmail.set(email, {
        _id: existingIdByEmail.get(email) || new ObjectId(),
        name: ft.name || email,
        email,
        password: ft.password || null,
        authProvider: "local",
        azureAdId: null,
        managerId: null,
        shift: null,
        roles: { timesheet: "employee", pms: "employee", tracker: ft.role || "BUSINESS_USER" },
        archived: { timesheet: false, pms: false, account: false },
        approvalStatus: ft.approvalStatus || "Approved",
        approvedAt: ft.approvedAt || null,
        approvedBy: ft.approvedBy || null,
        rejectedBy: ft.rejectedBy || null,
        rejectedAt: ft.rejectedAt || null,
        editedBy: ft.editedBy || null,
        editedAt: ft.editedAt || null,
        isEdited: Boolean(ft.isEdited),
        createdAt: ft.createdAt || new Date(),
        _sources: { flowtrackerId: ft._id?.toString() },
      });
      report.usersFromFlowtrackerOnly += 1;
    }
  }

  for (const user of byEmail.values()) {
    if (user._sources.timeflowId) userIdMap.set(`timeflow:${user._sources.timeflowId}`, user._id);
    if (user._sources.flowtrackerId) userIdMap.set(`flowtracker:${user._sources.flowtrackerId}`, user._id);
  }

  for (const user of byEmail.values()) {
    const oldManagerId = user._sources.timeflowManagerId;
    if (oldManagerId) user.managerId = userIdMap.get(`timeflow:${oldManagerId}`) || null;
    delete user._sources;
  }

  report.usersTotal = byEmail.size;

  if (commit) {
    const ops = [...byEmail.values()].map((user) => ({
      replaceOne: { filter: { email: user.email }, replacement: user, upsert: true },
    }));
    if (ops.length) await targetDb.collection("users").bulkWrite(ops);
  }

  return { userIdMap, byEmail };
}

export async function migrateProjects({ timeflowDb, flowtrackerDb, targetDb, userIdMap, byEmail, report, commit }) {
  const byName = new Map();
  const projectIdMap = new Map();
  const projectNameToId = new Map(); // normalized name -> new ObjectId (timesheet rows reference projects by name)

  // Same re-run hazard as users: reuse an already-migrated project's real _id
  // instead of generating a new one every run.
  const existingProjects = await targetDb.collection("projects").find({}, { projection: { name: 1 } }).toArray();
  const existingIdByName = new Map(existingProjects.map((p) => [normName(p.name), p._id]));

  const timeflowProjects = await timeflowDb.collection("projects").find({}).toArray();
  const flowtrackerProjects = await flowtrackerDb.collection("projects").find({}).toArray();
  const teamMembers = await timeflowDb.collection("team_members").find({}).toArray();

  for (const tf of timeflowProjects) {
    const key = normName(tf.name || tf.projectName);
    if (!key) continue;
    byName.set(key, {
      _id: existingIdByName.get(key) || new ObjectId(),
      name: tf.name || tf.projectName,
      description: tf.description || tf.projectDescription || "",
      status: "Planning",
      priority: "Medium",
      startDate: null,
      endDate: null,
      poc: { name: tf.pocName || "", email: normEmail(tf.pocEmail), phone: tf.pocPhone || "" },
      projectLead: null,
      teamMembers: [],
      holidays: tf.holidays || [],
      attachments: [],
      createdBy: userIdMap.get(`timeflow:${tf.created_by}`) || null,
      createdAt: tf.created_at || new Date(),
      _sources: { timeflowId: tf._id?.toString() },
    });
  }

  for (const ft of flowtrackerProjects) {
    const key = normName(ft.name);
    if (!key) continue;
    const existing = byName.get(key);
    const ftTeamMembers = (ft.teamMembers || []).map((id) => userIdMap.get(`flowtracker:${id.toString()}`)).filter(Boolean);
    const ftLead = ft.projectLead ? userIdMap.get(`flowtracker:${ft.projectLead.toString()}`) : null;
    const ftCreatedBy = ft.createdBy ? userIdMap.get(`flowtracker:${ft.createdBy.toString()}`) : null;

    if (existing) {
      existing.status = ft.status || existing.status;
      existing.priority = ft.priority || existing.priority;
      existing.startDate = ft.startDate || existing.startDate;
      existing.endDate = ft.endDate || existing.endDate;
      existing.projectLead = ftLead || existing.projectLead;
      existing.teamMembers = [...new Set([...existing.teamMembers, ...ftTeamMembers])];
      existing.attachments = ft.attachments || existing.attachments;
      existing.createdBy = existing.createdBy || ftCreatedBy;
      existing._sources.flowtrackerId = ft._id?.toString();
      report.projectsMerged += 1;
    } else {
      byName.set(key, {
        _id: existingIdByName.get(key) || new ObjectId(),
        name: ft.name,
        description: ft.description || "",
        status: ft.status || "Planning",
        priority: ft.priority || "Medium",
        startDate: ft.startDate || null,
        endDate: ft.endDate || null,
        poc: { name: "", email: "", phone: "" },
        projectLead: ftLead,
        teamMembers: ftTeamMembers,
        holidays: [],
        attachments: ft.attachments || [],
        createdBy: ftCreatedBy,
        createdAt: ft.createdAt || new Date(),
        _sources: { flowtrackerId: ft._id?.toString() },
      });
      report.projectsFromFlowtrackerOnly += 1;
    }
  }

  for (const tm of teamMembers) {
    const memberEmail = normEmail(tm.email);
    const unifiedUser = byEmail.get(memberEmail);
    for (const projectName of tm.projects || []) {
      const key = normName(projectName);
      const project = byName.get(key);
      if (!project) {
        report.unmatchedTeamMemberProjects.push({ projectName, memberEmail });
        continue;
      }
      if (!unifiedUser) {
        report.unmatchedTeamMemberProjects.push({ projectName, memberEmail, reason: "no matching user" });
        continue;
      }
      if (!project.teamMembers.some((id) => id.equals(unifiedUser._id))) {
        project.teamMembers.push(unifiedUser._id);
      }
    }
  }

  for (const [name, project] of byName.entries()) {
    if (project._sources.timeflowId) projectIdMap.set(`timeflow:${project._sources.timeflowId}`, project._id);
    if (project._sources.flowtrackerId) projectIdMap.set(`flowtracker:${project._sources.flowtrackerId}`, project._id);
    projectNameToId.set(name, project._id);
    delete project._sources;
  }

  report.projectsTotal = byName.size;

  if (commit) {
    const ops = [...byName.values()].map((project) => ({
      replaceOne: { filter: { name: project.name }, replacement: project, upsert: true },
    }));
    if (ops.length) await targetDb.collection("projects").bulkWrite(ops);
  }

  return { projectIdMap, projectNameToId };
}
