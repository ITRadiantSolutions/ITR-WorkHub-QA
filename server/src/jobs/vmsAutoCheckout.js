// Ported from the standalone VMS project's jobs/autoCheckout.js — force
// check-out any visitor still marked checked-in after `hours` hours, so a
// forgotten check-out doesn't leave them "in the building" forever.
import cron from "node-cron";
import Visitor, { VISIT_STATUS } from "../models/Visitor.js";
import { writeAuditLog } from "../utils/activityLog.js";

export async function runVmsAutoCheckout({ hours = 8, batchSize = 1000 } = {}) {
  const threshold = new Date(Date.now() - hours * 60 * 60 * 1000);

  const candidates = await Visitor.find({
    status: VISIT_STATUS.CHECKED_IN,
    checkInTime: { $lte: threshold },
  })
    .limit(batchSize)
    .lean();

  let updatedCount = 0;
  for (const before of candidates) {
    const updated = await Visitor.findByIdAndUpdate(
      before._id,
      { status: VISIT_STATUS.CHECKED_OUT, checkOutTime: new Date() },
      { new: true },
    ).lean();
    if (!updated) continue;

    updatedCount += 1;
    await writeAuditLog({
      type: "database",
      action: `AUTO_CHECK_OUT_${hours}_HOURS`,
      event: `AUTO_CHECK_OUT_${hours}_HOURS`,
      targetId: before._id.toString(),
      oldValue: before,
      newValue: updated,
    });
  }

  return { updatedCount };
}

export function startVmsCronJobs() {
  // Every 30 minutes — force-checkout anyone still "checked in" after 8 hours.
  cron.schedule("*/30 * * * *", () => runVmsAutoCheckout().catch(console.error), { timezone: "Asia/Kolkata" });
}
