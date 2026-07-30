// One-time data fix: the old TimeFlow system stored each day's logged time
// as raw HOURS in a field called `secs`, and migrateTimesheets() copied that
// straight across into the new schema (which genuinely expects seconds).
// Net effect: an entered "8" (hours) ended up stored as `secs: 8`, which the
// app then displays as 8 / 3600 = 0.00222h instead of 8h.
//
// Scope: only documents carrying a `_legacyId` (i.e. rows written by the
// migration) are touched — anything created live through the app's own
// Save/Submit flow already stores correct seconds and must be left alone.
//
// Dry-run by default: prints a report, writes nothing. Pass --commit to apply.
// Safe to re-run: each fixed document is stamped `secsUnitsFixed: true` and
// skipped on subsequent runs, so re-running (even with --commit) never
// re-multiplies an already-fixed row.

import "dotenv/config";
import { connect } from "./lib/shared.js";

const COMMIT = process.argv.includes("--commit");
const SECONDS_PER_HOUR = 3600;

async function main() {
  const { client, db } = await connect(
    process.env.TARGET_MONGO_URI,
    process.env.TARGET_DB_NAME || "itr_one",
    "target (itr_one)",
  );

  try {
    const collection = db.collection("timesheets");
    const candidates = await collection
      .find({ _legacyId: { $exists: true }, secsUnitsFixed: { $ne: true } })
      .toArray();

    let rowsFixed = 0;
    let sample = null;
    const ops = [];

    for (const doc of candidates) {
      const rows = (doc.rows || []).map((row) => {
        rowsFixed += 1;
        return { ...row, secs: (row.secs || []).map((s) => (s || 0) * SECONDS_PER_HOUR) };
      });

      if (!sample) {
        sample = {
          timesheetId: doc._id,
          before: doc.rows?.[0]?.secs,
          after: rows[0]?.secs,
        };
      }

      ops.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { rows, secsUnitsFixed: true } },
        },
      });
    }

    console.log(`Timesheets to fix: ${candidates.length}`);
    console.log(`Rows to convert:   ${rowsFixed}`);
    if (sample) console.log("Sample conversion:", sample);

    if (!COMMIT) {
      console.log("\nDry run only — pass --commit to apply.");
      return;
    }

    if (ops.length) {
      const result = await collection.bulkWrite(ops);
      console.log(`\nUpdated ${result.modifiedCount} timesheet(s).`);
    } else {
      console.log("\nNothing to update.");
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
