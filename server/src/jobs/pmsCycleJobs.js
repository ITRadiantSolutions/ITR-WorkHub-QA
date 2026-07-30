// Ported from ITR_TimeFlow_Production's cycle_reminders.py (daily_cycle_reminder,
// 16:20 IST) and pms/pms_cycleroutes.py::disable_expired_cycles (16:25 IST).
import cron from "node-cron";
import Cycle from "../models/Cycle.js";
import User from "../models/User.js";
import { sendMail } from "../utils/graphMailer.js";
import { disableExpiredCycles } from "../controllers/cycleController.js";

const daysUntil = (date) => Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
const isSameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

async function remindForWindow(cycle, windowKey, lastReminderKey, thresholdDays, label) {
  const window = cycle[windowKey];
  if (!window.enabled || !window.expiry) return false;

  const daysLeft = daysUntil(window.expiry);
  if (daysLeft < 0 || daysLeft > thresholdDays) return false;

  const lastSent = cycle.reminders[lastReminderKey];
  if (lastSent && isSameDay(lastSent, new Date())) return false; // already sent today

  const filter = window.selectedUserIds.length ? { _id: { $in: window.selectedUserIds } } : {};
  const users = await User.find(filter).select("name email archived");

  for (const user of users) {
    if (user.archived.pms || !user.email) continue;
    try {
      await sendMail(
        user.email,
        `Reminder: PMS cycle "${cycle.name}" closing soon`,
        `<p>Hi ${user.name},</p><p>The ${label} response window for cycle <strong>${cycle.name}</strong> closes in ${daysLeft} day(s).</p>`,
      );
    } catch {
      // best-effort — one failed send shouldn't block the rest
    }
  }

  cycle.reminders[lastReminderKey] = new Date();
  return true;
}

export async function sendCycleReminders() {
  const cycles = await Cycle.find({
    $or: [{ "employeeResponse.enabled": true }, { "managerResponse.enabled": true }],
  });

  let remindersSent = 0;
  for (const cycle of cycles) {
    const employeeSent = await remindForWindow(
      cycle,
      "employeeResponse",
      "lastEmployeeReminderDate",
      cycle.reminders.employeeReminderDays,
      "employee",
    );
    const managerSent = await remindForWindow(
      cycle,
      "managerResponse",
      "lastManagerReminderDate",
      cycle.reminders.managerReminderDays,
      "manager",
    );
    if (employeeSent || managerSent) {
      await cycle.save();
      remindersSent += 1;
    }
  }

  return { cyclesProcessed: cycles.length, remindersSent };
}

export function startPmsCronJobs() {
  cron.schedule("20 16 * * *", () => sendCycleReminders().catch(console.error), { timezone: "Asia/Kolkata" });
  cron.schedule("25 16 * * *", () => disableExpiredCycles().catch(console.error), { timezone: "Asia/Kolkata" });
}
