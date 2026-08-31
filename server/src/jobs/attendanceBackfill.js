// recomputeDay (hrmsAttendanceController.js) only ever runs reactively, from
// a device/manual punch or an approved regularization — so an employee who
// generates zero punches on a given day (approved leave, a company holiday,
// a weekend, or a genuine no-punch absence) never gets an AttendanceDay row
// for it at all. That silently undercounts HR's daily summary (they show up
// as "not yet recorded" instead of "on leave"/"weekend"/etc.) and leaves
// gaps in the employee's own attendance calendar. This job materializes
// yesterday's row for every active employee, punches or not, once it's
// fully closed out.
import cron from "node-cron";
import User from "../models/User.js";
import { recomputeDay } from "../controllers/hrmsAttendanceController.js";

const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export async function runAttendanceBackfill({ dateStr, batchSize = 50 } = {}) {
  const targetDate = dateStr || toISODate(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const employees = await User.find({ "archived.account": { $ne: true }, "archived.hrms": { $ne: true } }).select("_id");

  // One employee with bad data (e.g. a malformed record) shouldn't take down
  // the whole night's run for everyone else — catch and log per-employee,
  // keep going.
  let processed = 0;
  let failed = 0;
  for (let i = 0; i < employees.length; i += batchSize) {
    const batch = employees.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map((e) => recomputeDay(e._id, targetDate)));
    for (const r of results) {
      if (r.status === "fulfilled") processed += 1;
      else failed += 1;
    }
  }
  if (failed > 0) console.error(`Attendance backfill for ${targetDate}: ${failed} employee(s) failed`);

  return { date: targetDate, processed, failed };
}

export function startAttendanceBackfillJob() {
  // 01:00 IST — well after midnight, so "yesterday" is fully closed out and
  // any late-arriving device punches for it have already landed.
  cron.schedule("0 1 * * *", () => runAttendanceBackfill().catch(console.error), { timezone: "Asia/Kolkata" });
}
