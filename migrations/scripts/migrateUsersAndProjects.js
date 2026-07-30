// Standalone Phase 0 migration: users + projects only.
// For the full migration (timesheets, tasks/sprints/stories/bugs, PMS, etc.)
// use migrateAll.js instead — it runs this same logic as its first two steps.
//
// Dry-run by default: prints a report, writes nothing. Pass --commit to apply.
// Safe to re-run with --commit: upserts by email (users) / by name (projects).

import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connect, migrateUsers, migrateProjects } from "./lib/shared.js";

const COMMIT = process.argv.includes("--commit");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "..", "output");

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
    const { userIdMap, byEmail } = await migrateUsers({
      timeflowDb: timeflow.db,
      flowtrackerDb: flowtracker.db,
      targetDb: target.db,
      report,
      commit: COMMIT,
    });

    const { projectIdMap } = await migrateProjects({
      timeflowDb: timeflow.db,
      flowtrackerDb: flowtracker.db,
      targetDb: target.db,
      userIdMap,
      byEmail,
      report,
      commit: COMMIT,
    });

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
    console.log(
      COMMIT
        ? "\nCommitted to target DB. Id maps written to migrations/output/."
        : "\nDRY RUN — no writes performed. Re-run with --commit to apply. Id maps still written to migrations/output/ for review.",
    );
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
