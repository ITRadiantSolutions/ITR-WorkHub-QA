// Full migration: every collection in the unified schema, old TimeFlow +
// Flow_Tracker databases -> the new itr_one database.
//
// Dry-run by default: prints a report, writes nothing. Pass --commit to apply.
// Safe to re-run with --commit: every migrated doc gets a `_legacyId` field
// ("timeflow:<oldId>" or "flowtracker:<oldId>") and is upserted on it, so
// re-running never creates duplicates. Users/projects are upserted by
// email/name instead (see lib/shared.js) since they can merge two source docs
// into one and so don't have a single _legacyId.
//
// Run order matters: users -> projects -> (shifts folded into users) ->
// timesheets, and for Flow_Tracker: sprints -> tasks -> stories/bugs ->
// client groups -> notifications -> user issues. PMS collections only depend
// on users, so they can run any time after that.

import "dotenv/config";
import { ObjectId } from "mongodb";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connect, normEmail, normName, migrateUsers, migrateProjects } from "./lib/shared.js";

const COMMIT = process.argv.includes("--commit");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "..", "output");

const upsertByLegacyId = async (targetDb, collectionName, docs) => {
  if (!COMMIT || !docs.length) return;
  const ops = docs.map((doc) => ({
    replaceOne: { filter: { _legacyId: doc._legacyId }, replacement: doc, upsert: true },
  }));
  await targetDb.collection(collectionName).bulkWrite(ops);
};

async function migrateShiftsIntoUsers({ timeflowDb, targetDb, userIdMap, report }) {
  const shifts = await timeflowDb.collection("shifts").find({}).toArray();
  let matched = 0;
  const ops = [];
  for (const s of shifts) {
    const newUserId = userIdMap.get(`timeflow:${s.user_id}`);
    if (!newUserId) continue;
    matched += 1;
    if (COMMIT) ops.push({ updateOne: { filter: { _id: newUserId }, update: { $set: { shift: s.shift } } } });
  }
  if (ops.length) await targetDb.collection("users").bulkWrite(ops);
  report.shiftsMatched = matched;
  report.shiftsTotal = shifts.length;
}

async function migrateTimesheets({ timeflowDb, targetDb, userIdMap, projectNameToId, report }) {
  const timesheets = await timeflowDb.collection("timesheets").find({}).toArray();
  const docs = [];
  let unmatchedProjectRefs = 0;

  for (const ts of timesheets) {
    const userId = userIdMap.get(`timeflow:${ts.user_id}`);
    if (!userId) {
      report.timesheetsSkippedNoUser = (report.timesheetsSkippedNoUser || 0) + 1;
      continue;
    }
    const rows = (ts.rows || []).map((row) => {
      const projectId = projectNameToId.get(normName(row.project));
      if (!projectId) unmatchedProjectRefs += 1;
      return {
        projectId: projectId || null,
        task: row.task || "",
        secs: row.secs || Array(7).fill(0),
        nsa: row.nsa || Array(7).fill(false),
        comment: row.comment || "",
      };
    });

    docs.push({
      _legacyId: `timeflow:${ts._id}`,
      userId,
      managerId: userIdMap.get(`timeflow:${ts.manager_id}`) || null,
      weekStart: new Date(ts.week_start),
      weekEnd: new Date(ts.week_end),
      status: ts.status || "draft",
      rows,
      comment: ts.comment || "",
      submittedAt: ts.submitted_at ? new Date(ts.submitted_at) : null,
      managerActionBy: null,
      managerActionAt: null,
      createdAt: ts.created_at || new Date(),
    });
  }

  await upsertByLegacyId(targetDb, "timesheets", docs);
  report.timesheetsTotal = docs.length;
  report.timesheetsWithUnmatchedProjectRows = unmatchedProjectRefs;
}

async function migrateSprints({ flowtrackerDb, targetDb, userIdMap, projectIdMap, report }) {
  const sprints = await flowtrackerDb.collection("sprints").find({}).toArray();
  const sprintIdMap = new Map();
  const docs = [];

  for (const s of sprints) {
    const newId = new ObjectId();
    sprintIdMap.set(s._id.toString(), newId);
    docs.push({
      _id: newId,
      _legacyId: `flowtracker:${s._id}`,
      name: s.name,
      projectId: projectIdMap.get(`flowtracker:${s.projectId}`) || null,
      startDate: s.startDate,
      endDate: s.endDate,
      goal: s.goal || "",
      status: s.status || "Planning",
      createdBy: userIdMap.get(`flowtracker:${s.createdBy}`) || null,
      comments: (s.comments || []).map((c) => ({
        text: c.text,
        user: userIdMap.get(`flowtracker:${c.user}`) || null,
        createdAt: c.createdAt,
      })),
      createdAt: s.createdAt || new Date(),
    });
  }

  await upsertByLegacyId(targetDb, "sprints", docs);
  report.sprintsTotal = docs.length;
  return { sprintIdMap };
}

async function migrateTasks({ flowtrackerDb, targetDb, userIdMap, projectIdMap, report }) {
  const tasks = await flowtrackerDb.collection("tasks").find({}).toArray();
  const taskIdMap = new Map();
  const docs = [];

  for (const t of tasks) {
    const newId = new ObjectId();
    taskIdMap.set(t._id.toString(), newId);
    docs.push({
      _id: newId,
      _legacyId: `flowtracker:${t._id}`,
      title: t.title,
      description: t.description || "",
      projectId: projectIdMap.get(`flowtracker:${t.projectId}`) || null,
      assignees: (t.assignees || []).map((id) => userIdMap.get(`flowtracker:${id}`)).filter(Boolean),
      createdBy: userIdMap.get(`flowtracker:${t.createdBy}`) || null,
      status: t.status || "TODO",
      closedBy: t.closedBy ? userIdMap.get(`flowtracker:${t.closedBy}`) || null : null,
      closedAt: t.closedAt || null,
      assignedAt: t.assignedAt || new Date(),
      priority: t.priority || "Medium",
      dueDate: t.dueDate,
      comments: (t.comments || []).map((c) => ({
        user: userIdMap.get(`flowtracker:${c.user}`) || null,
        text: c.text,
        createdAt: c.createdAt,
      })),
      bugs: [], // resolved after migrateBugs runs (bug ids don't exist yet)
      createdAt: t.createdAt || new Date(),
    });
  }

  await upsertByLegacyId(targetDb, "tasks", docs);
  report.tasksTotal = docs.length;
  return { taskIdMap };
}

async function migrateStories({ flowtrackerDb, targetDb, userIdMap, sprintIdMap, report }) {
  const stories = await flowtrackerDb.collection("stories").find({}).toArray();
  const docs = stories.map((s) => ({
    _legacyId: `flowtracker:${s._id}`,
    storyId: s.storyId,
    title: s.title,
    description: s.description || "",
    storyPoints: s.storyPoints || 0,
    priority: s.priority || "Medium",
    status: s.status || "To Do",
    createdBy: userIdMap.get(`flowtracker:${s.createdBy}`) || null,
    assignee: s.assignee ? userIdMap.get(`flowtracker:${s.assignee}`) || null : null,
    acceptanceCriteria: s.acceptanceCriteria || "",
    sprintId: sprintIdMap.get(s.sprintId?.toString()) || null,
    comments: (s.comments || []).map((c) => ({
      user: userIdMap.get(`flowtracker:${c.user}`) || null,
      text: c.text,
      createdAt: c.createdAt,
    })),
    createdAt: s.createdAt || new Date(),
  }));

  await upsertByLegacyId(targetDb, "stories", docs);
  report.storiesTotal = docs.length;
}

async function migrateBugs({ flowtrackerDb, targetDb, userIdMap, taskIdMap, report }) {
  const bugs = await flowtrackerDb.collection("bugs").find({}).toArray();
  const bugIdMap = new Map();
  const docs = [];

  for (const b of bugs) {
    const newId = new ObjectId();
    bugIdMap.set(b._id.toString(), newId);
    docs.push({
      _id: newId,
      _legacyId: `flowtracker:${b._id}`,
      title: b.title,
      description: b.description || "",
      severity: b.severity || "MEDIUM",
      status: b.status || "OPEN",
      taskId: taskIdMap.get(b.taskId?.toString()) || null,
      reportedBy: userIdMap.get(`flowtracker:${b.reportedBy}`) || null,
      attachments: b.attachments || [],
      createdAt: b.createdAt || new Date(),
    });
  }

  await upsertByLegacyId(targetDb, "bugs", docs);
  report.bugsTotal = docs.length;

  // Back-fill Task.bugs[] now that bug ids exist.
  if (COMMIT) {
    const byTask = new Map();
    for (const bug of docs) {
      if (!bug.taskId) continue;
      const list = byTask.get(bug.taskId.toString()) || [];
      list.push(bug._id);
      byTask.set(bug.taskId.toString(), list);
    }
    const ops = [...byTask.entries()].map(([taskId, bugIds]) => ({
      updateOne: { filter: { _id: new ObjectId(taskId) }, update: { $set: { bugs: bugIds } } },
    }));
    if (ops.length) await targetDb.collection("tasks").bulkWrite(ops);
  }

  return { bugIdMap };
}

async function migrateClientGroups({ flowtrackerDb, targetDb, userIdMap, projectIdMap, report }) {
  const groups = await flowtrackerDb.collection("clientgroups").find({}).toArray();
  const docs = groups.map((g) => ({
    _legacyId: `flowtracker:${g._id}`,
    name: g.name,
    description: g.description || "",
    status: g.status || "Active",
    projects: (g.projects || []).map((id) => projectIdMap.get(`flowtracker:${id}`)).filter(Boolean),
    createdBy: userIdMap.get(`flowtracker:${g.createdBy}`) || null,
    createdAt: g.createdAt || new Date(),
  }));
  await upsertByLegacyId(targetDb, "client_groups", docs);
  report.clientGroupsTotal = docs.length;
}

async function migrateNotifications({ flowtrackerDb, targetDb, userIdMap, projectIdMap, taskIdMap, sprintIdMap, bugIdMap, report }) {
  const [live, history] = await Promise.all([
    flowtrackerDb.collection("notifications").find({}).toArray(),
    flowtrackerDb.collection("notificationhistories").find({}).toArray(),
  ]);

  const toDoc = (n, archived) => ({
    _legacyId: `flowtracker:${n._id}`,
    userId: userIdMap.get(`flowtracker:${n.userId}`) || null,
    title: n.title,
    message: n.message,
    type: n.type,
    roleTargets: n.roleTargets || [],
    taskId: n.taskId ? taskIdMap.get(n.taskId.toString()) || null : null,
    projectId: n.projectId ? projectIdMap.get(`flowtracker:${n.projectId}`) || null : null,
    sprintId: n.sprintId ? sprintIdMap.get(n.sprintId.toString()) || null : null,
    bugId: n.bugId ? bugIdMap.get(n.bugId.toString()) || null : null,
    activityType: n.activityType,
    performedBy: n.performedBy ? userIdMap.get(`flowtracker:${n.performedBy}`) || null : null,
    isRead: Boolean(n.isRead),
    archivedAt: archived ? n.createdAt || new Date() : null,
    metadata: n.metadata || {},
    createdAt: n.createdAt || new Date(),
  });

  const docs = [...live.map((n) => toDoc(n, false)), ...history.map((n) => toDoc(n, true))];
  await upsertByLegacyId(targetDb, "notifications", docs);
  report.notificationsTotal = docs.length;
}

async function migrateUserIssues({ flowtrackerDb, targetDb, userIdMap, report }) {
  const issues = await flowtrackerDb.collection("userissues").find({}).toArray();
  const docs = issues.map((i) => ({
    _legacyId: `flowtracker:${i._id}`,
    message: i.message,
    submittedBy: userIdMap.get(`flowtracker:${i.submittedBy}`) || null,
    role: i.role,
    status: i.status || "OPEN",
    createdAt: i.createdAt || new Date(),
  }));
  await upsertByLegacyId(targetDb, "user_issues", docs);
  report.userIssuesTotal = docs.length;
}

async function migratePmsCycles({ timeflowDb, targetDb, userIdMap, report }) {
  const cycles = await timeflowDb.collection("cycles").find({}).toArray();
  const cycleIdMap = new Map();
  const docs = [];

  for (const c of cycles) {
    const newId = new ObjectId();
    cycleIdMap.set(c._id.toString(), newId);
    const mapUsers = (ids) => (ids || []).map((id) => userIdMap.get(`timeflow:${id}`)).filter(Boolean);
    docs.push({
      _id: newId,
      _legacyId: `timeflow:${c._id}`,
      name: c.name,
      type: c.type || null,
      start: new Date(c.start),
      end: new Date(c.end),
      employeeResponse: {
        enabled: Boolean(c.employeeResponseEnabled),
        expiry: c.employeeResponseExpiry || null,
        durationDays: c.employeeResponseDurationDays || null,
        selectedUserIds: mapUsers(c.selectedEmployees),
      },
      managerResponse: {
        enabled: Boolean(c.managerResponseEnabled),
        expiry: c.managerResponseExpiry || null,
        durationDays: c.managerResponseDurationDays || null,
        selectedUserIds: mapUsers(c.selectedManagers),
      },
      reportVisibility: {
        mode: c.reportVisibility || "none",
        visibleTo: mapUsers(c.reportVisibleTo),
        visibleToHistory: [],
      },
      reminders: {
        employeeReminderDays: c.employeeReminderDays ?? 3,
        managerReminderDays: c.managerReminderDays ?? 3,
        lastEmployeeReminderDate: c.lastEmployeeReminderDate || null,
        lastManagerReminderDate: c.lastManagerReminderDate || null,
      },
      formConfig: { employeeWeightLimit: 100, kras: [], selectedQuarters: [], autoCreated: false },
      createdBy: null,
    });
  }

  await upsertByLegacyId(targetDb, "cycles", docs);
  report.cyclesTotal = docs.length;
  return { cycleIdMap };
}

async function migratePmsKraDefinitions({ timeflowDb, targetDb, userIdMap, report }) {
  const library = await timeflowDb.collection("kra_library").find({}).toArray();
  const masterTemplates = await timeflowDb.collection("kra_master_templates").find({}).toArray();

  const libraryDocs = library.map((doc) => ({
    _legacyId: `timeflow:library:${doc._id}`,
    scope: "library",
    type: doc.type || null,
    name: null,
    kras: (doc.kras || []).map((k) => ({ originalId: null, name: k.name, type: k.type || doc.type, kpis: k.kpis || [] })),
    createdBy: null,
  }));

  const templateDocs = masterTemplates.map((doc) => ({
    _legacyId: `timeflow:masterTemplate:${doc._id}`,
    scope: "master_template",
    type: null,
    name: doc.name,
    kras: (doc.kras || []).map((k) => ({ originalId: null, name: k.name, type: k.type, kpis: k.kpis || [] })),
    createdBy: userIdMap.get(`timeflow:${doc.createdBy}`) || null,
  }));

  const docs = [...libraryDocs, ...templateDocs];
  await upsertByLegacyId(targetDb, "kra_definitions", docs);
  report.kraDefinitionsTotal = docs.length;
}

async function migratePmsKraAssignments({ timeflowDb, targetDb, userIdMap, cycleIdMap, report }) {
  const assignments = await timeflowDb.collection("kpi_templates").find({}).toArray();
  const docs = assignments
    .map((a) => ({
      _legacyId: `timeflow:${a._id}`,
      cycleId: cycleIdMap.get(a.cycleId?.toString()) || null,
      templateId: null,
      assignedTo: userIdMap.get(`timeflow:${a.assignedToId}`) || null,
      kras: (a.kras || []).map((k) => ({ defRef: null, name: k.name, type: k.type, weight: k.weight, kpis: k.kpis || [] })),
      status: a.status || "draft",
      submittedAt: a.submittedAt || null,
      createdBy: userIdMap.get(`timeflow:${a.createdBy}`) || null,
      updatedBy: userIdMap.get(`timeflow:${a.updatedBy}`) || null,
    }))
    .filter((a) => a.assignedTo); // group-assignment rows without a resolvable user are dropped (already expanded per-member upstream)

  await upsertByLegacyId(targetDb, "kra_assignments", docs);
  report.kraAssignmentsTotal = docs.length;
  report.kraAssignmentsSkipped = assignments.length - docs.length;
}

async function migratePmsSubmissions({ timeflowDb, targetDb, userIdMap, cycleIdMap, report }) {
  const [responses, submissions, reportSummaries] = await Promise.all([
    timeflowDb.collection("template_responses").find({}).toArray(),
    timeflowDb.collection("template_submissions").find({}).toArray(),
    timeflowDb.collection("report_summary").find({}).toArray(),
  ]);

  // Group by (cycleId-ish templateId, employeeId) since the old schema keyed
  // everything off templateId rather than cycleId directly.
  const byKey = new Map();
  const keyOf = (templateId, employeeId) => `${templateId}:${employeeId}`;

  for (const sub of submissions) {
    const key = keyOf(sub.templateId, sub.employeeId);
    byKey.set(key, {
      _legacyId: `timeflow:submission:${sub._id}`,
      cycleId: cycleIdMap.get(sub.cycleId?.toString()) || null,
      assignmentId: null,
      employeeId: userIdMap.get(`timeflow:${sub.employeeId}`) || null,
      managerId: userIdMap.get(`timeflow:${sub.managerId}`) || null,
      status: sub.status || "draft",
      kraResponses: [],
      finalReport: { managerSubmitted: false, managerOverallResponse: "", managerAvg: null, overallRating: null, oneOnOneDate: null, oneOnOneComment: "" },
    });
  }

  for (const resp of responses) {
    const key = keyOf(resp.templateId, resp.userId);
    let doc = byKey.get(key);
    if (!doc) {
      doc = {
        _legacyId: `timeflow:submission:resp:${resp.templateId}:${resp.userId}`,
        cycleId: null,
        assignmentId: null,
        employeeId: userIdMap.get(`timeflow:${resp.userId}`) || null,
        managerId: userIdMap.get(`timeflow:${resp.assignedManagerId}`) || null,
        status: resp.status || "draft",
        kraResponses: [],
        finalReport: { managerSubmitted: false, managerOverallResponse: "", managerAvg: null, overallRating: null, oneOnOneDate: null, oneOnOneComment: "" },
      };
      byKey.set(key, doc);
    }
    doc.kraResponses.push({
      kraId: null,
      kraName: resp.kraName,
      weight: resp.weight,
      kpis: resp.kpis || [],
      response: resp.response || "",
      rating: resp.rating ?? null,
      managerResponse: resp.managerResponse || "",
      managerRating: resp.managerRating ?? null,
      status: resp.status || "pending",
      employeeSubmittedAt: resp.employeeSubmittedAt || null,
      reviewedAt: resp.reviewedAt || null,
    });
  }

  for (const summary of reportSummaries) {
    const key = keyOf(summary.templateId, summary.employeeId);
    const doc = byKey.get(key);
    if (!doc) continue;
    doc.finalReport = {
      managerSubmitted: Boolean(summary.managerSubmitted),
      managerOverallResponse: summary.managerOverallResponse || "",
      managerAvg: summary.managerAvg ?? null,
      overallRating: summary.overallRating ?? null,
      oneOnOneDate: summary.oneOnOneDate || null,
      oneOnOneComment: summary.oneOnOneComment || "",
    };
  }

  const docs = [...byKey.values()].filter((d) => d.employeeId);
  await upsertByLegacyId(targetDb, "submissions", docs);
  report.submissionsTotal = docs.length;
}

async function migratePmsPips({ timeflowDb, targetDb, userIdMap, report }) {
  const pips = await timeflowDb.collection("pips").find({}).toArray();
  const docs = pips
    .map((p) => ({
      _legacyId: `timeflow:${p._id}`,
      employeeId: userIdMap.get(`timeflow:${p.employee_id}`) || null,
      status: p.status || "active",
      outcome: p.outcome || null,
      startDate: p.startDate,
      targetEndDate: p.targetEndDate,
      reason: p.reason || "",
      reviewNotes: p.reviewNotes || "",
      goals: (p.goals || []).map((g) => ({
        title: g.title,
        successMeasure: g.successMeasure || "",
        progressStatus: g.progressStatus || "not_started",
        checkpointDate: g.checkpointDate || null,
        proofDocuments: g.proofDocuments || [],
        notes: g.notes || "",
      })),
      employeeSubmitted: Boolean(p.employeeSubmitted),
      submittedManagerName: p.submittedManagerName || null,
      createdBy: userIdMap.get(`timeflow:${p.createdBy}`) || null,
      updatedBy: userIdMap.get(`timeflow:${p.updatedBy}`) || null,
    }))
    .filter((p) => p.employeeId);

  await upsertByLegacyId(targetDb, "pips", docs);
  report.pipsTotal = docs.length;
  report.pipsSkipped = pips.length - docs.length;
}

async function migratePmsUsersGroup({ timeflowDb, targetDb, userIdMap, report }) {
  const groups = await timeflowDb.collection("users_group").find({}).toArray();
  const docs = groups.map((g) => ({
    _legacyId: `timeflow:${g._id}`,
    name: g.name,
    description: g.description || "",
    members: (g.members || []).map((id) => userIdMap.get(`timeflow:${id}`)).filter(Boolean),
    createdBy: null,
  }));
  await upsertByLegacyId(targetDb, "users_group", docs);
  report.usersGroupTotal = docs.length;
}

async function main() {
  const report = {
    usersFromTimeflow: 0,
    usersFromFlowtrackerOnly: 0,
    usersMerged: 0,
    usersTotal: 0,
    nameMismatches: [],
    projectsMerged: 0,
    projectsFromFlowtrackerOnly: 0,
    projectsTotal: 0,
    unmatchedTeamMemberProjects: [],
  };

  const timeflow = await connect(process.env.TIMEFLOW_MONGO_URI, process.env.TIMEFLOW_DB_NAME || "timesheet_db", "TimeFlow");
  const flowtracker = await connect(process.env.FLOWTRACKER_MONGO_URI, process.env.FLOWTRACKER_DB_NAME, "Flow_Tracker");
  const target = await connect(process.env.TARGET_MONGO_URI, process.env.TARGET_DB_NAME || "itr_one", "target (itr_one)");

  try {
    const ctx = { timeflowDb: timeflow.db, flowtrackerDb: flowtracker.db, targetDb: target.db, report, commit: COMMIT };

    console.log("Migrating users...");
    const { userIdMap, byEmail } = await migrateUsers(ctx);

    console.log("Migrating projects...");
    const { projectIdMap, projectNameToId } = await migrateProjects({ ...ctx, userIdMap, byEmail });

    console.log("Folding shifts into users...");
    await migrateShiftsIntoUsers({ ...ctx, userIdMap });

    console.log("Migrating timesheets...");
    await migrateTimesheets({ ...ctx, userIdMap, projectNameToId });

    console.log("Migrating sprints...");
    const { sprintIdMap } = await migrateSprints({ ...ctx, userIdMap, projectIdMap });

    console.log("Migrating tasks...");
    const { taskIdMap } = await migrateTasks({ ...ctx, userIdMap, projectIdMap });

    console.log("Migrating stories...");
    await migrateStories({ ...ctx, userIdMap, sprintIdMap });

    console.log("Migrating bugs...");
    const { bugIdMap } = await migrateBugs({ ...ctx, userIdMap, taskIdMap });

    console.log("Migrating client groups...");
    await migrateClientGroups({ ...ctx, userIdMap, projectIdMap });

    console.log("Migrating notifications...");
    await migrateNotifications({ ...ctx, userIdMap, projectIdMap, taskIdMap, sprintIdMap, bugIdMap });

    console.log("Migrating user issues...");
    await migrateUserIssues({ ...ctx, userIdMap });

    console.log("Migrating PMS cycles...");
    const { cycleIdMap } = await migratePmsCycles({ ...ctx, userIdMap });

    console.log("Migrating PMS KRA definitions...");
    await migratePmsKraDefinitions({ ...ctx, userIdMap });

    console.log("Migrating PMS KRA assignments...");
    await migratePmsKraAssignments({ ...ctx, userIdMap, cycleIdMap });

    console.log("Migrating PMS submissions...");
    await migratePmsSubmissions({ ...ctx, userIdMap, cycleIdMap });

    console.log("Migrating PMS PIPs...");
    await migratePmsPips({ ...ctx, userIdMap });

    console.log("Migrating PMS users_group...");
    await migratePmsUsersGroup({ ...ctx, userIdMap });

    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(
      path.join(OUTPUT_DIR, "userIdMap.json"),
      JSON.stringify(Object.fromEntries([...userIdMap].map(([k, v]) => [k, v.toString()])), null, 2),
    );
    await writeFile(
      path.join(OUTPUT_DIR, "projectIdMap.json"),
      JSON.stringify(Object.fromEntries([...projectIdMap].map(([k, v]) => [k, v.toString()])), null, 2),
    );

    console.log(JSON.stringify(report, null, 2));
    console.log(COMMIT ? "\nCommitted to target DB." : "\nDRY RUN — no writes performed. Re-run with --commit to apply.");
  } finally {
    await timeflow.client.close();
    await flowtracker.client.close();
    await target.client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
