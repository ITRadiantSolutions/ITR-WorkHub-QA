// Ported from ITR_TimeFlow_Production's reminders_logic.py. The unified
// Timesheet schema stores weekStart/weekEnd as real Dates (not the mixed
// string/Date formats the old system had to defend against), which simplifies
// the "does a timesheet exist for this week" lookup considerably.
import cron from "node-cron";
import User from "../models/User.js";
import Timesheet from "../models/Timesheet.js";
import { sendMail } from "../utils/graphMailer.js";
import { startOfWeek, addDays } from "../utils/dateRanges.js";

const HANDLED_STATUSES = ["submitted", "approved", "rejected", "needs_edit"];
const fmt = (date) => date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function weeksToCheck(count = 4) {
  const thisWeekStart = startOfWeek(new Date());
  const weeks = [];
  for (let offset = 1; offset <= count; offset++) {
    const start = addDays(thisWeekStart, -7 * offset);
    weeks.push({ start, end: addDays(start, 6) });
  }
  return weeks;
}

const timesheetReminderBody = (name, pendingWeeks) => `
<html><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px;">
<table width="100%" cellpadding="0" cellspacing="0" style="border-left:4px solid #1d4ed8;padding-left:16px;">
<tr><td style="font-size:14px;color:#111827;">
<p>Hi <strong>${name}</strong>,</p>
<p>This is a reminder that you have <strong>${pendingWeeks.length}</strong> pending timesheet(s) that have not been submitted:</p>
<div style="padding-left:16px;margin:10px 0;">
${pendingWeeks.map((w) => `<p style="margin:4px 0;">&#8226; ${fmt(w.start)} to ${fmt(w.end)}</p>`).join("")}
</div>
<p>Please submit your timesheets at the earliest to ensure smooth payroll processing and accurate project tracking.</p>
<p>Thank you for your cooperation.</p>
</td></tr></table>
<p style="margin-top:16px;font-weight:600;color:#2563eb;">TimeFlow</p>
</td></tr></table></body></html>`;

export async function sendTimesheetReminders() {
  const users = await User.find({ "archived.timesheet": false, "archived.account": false });
  const sent = [];
  const errors = [];

  for (const user of users) {
    const email = (user.email || "").trim();
    if (!email || /no-?reply/i.test(email)) continue;

    const pendingWeeks = [];
    for (const week of weeksToCheck()) {
      const candidates = await Timesheet.find({
        userId: user._id,
        weekStart: { $lte: week.end },
        weekEnd: { $gte: week.start },
      });
      const handled = candidates.some((ts) => HANDLED_STATUSES.includes(ts.status));
      if (!handled) pendingWeeks.push(week);
    }

    if (!pendingWeeks.length) continue;

    try {
      await sendMail(email, "Reminder: Please Submit Your Timesheet", timesheetReminderBody(user.name, pendingWeeks));
      sent.push({ email, pendingWeeks: pendingWeeks.length });
    } catch (error) {
      errors.push({ email, error: error.message });
    }
  }

  return { count: sent.length, sent, errors };
}

const approvalReminderBody = (recipientLabel, lines) => `
<html><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px;">
<table width="100%" cellpadding="0" cellspacing="0" style="border-left:4px solid #1d4ed8;padding-left:16px;">
<tr><td style="font-size:14px;color:#111827;">
<p>Hi <strong>${recipientLabel}</strong>,</p>
<p>You have <strong>${lines.length}</strong> timesheet(s) pending review:</p>
<ul style="padding-left:20px;">${lines.map((l) => `<li>${l}</li>`).join("")}</ul>
<p>Please review and take the necessary action.</p>
</td></tr></table>
<p style="margin-top:16px;font-weight:600;color:#2563eb;">TimeFlow</p>
</td></tr></table></body></html>`;

export async function sendApprovalReminders() {
  const pending = await Timesheet.find({ status: "submitted" }).populate("userId", "name email");
  if (!pending.length) return { pendingCount: 0, managersEmailed: [], hrsEmailed: [] };

  const byManagerId = new Map();
  const allLines = [];

  for (const ts of pending) {
    const employeeName = ts.userId?.name || "Unknown";
    const line = `${employeeName} (week: ${ts.weekStart.toISOString().slice(0, 10)})`;
    if (ts.managerId) {
      const list = byManagerId.get(ts.managerId.toString()) || [];
      list.push(line);
      byManagerId.set(ts.managerId.toString(), list);
    }
    allLines.push(`${line} (manager: ${ts.managerId || "Unassigned"})`);
  }

  const managersEmailed = [];
  for (const [managerId, lines] of byManagerId.entries()) {
    const manager = await User.findById(managerId);
    if (!manager?.email) continue;
    try {
      await sendMail(manager.email, "Reminder: Timesheets Pending Your Approval", approvalReminderBody(manager.name, lines));
      managersEmailed.push(manager.email);
    } catch {
      // best-effort — one manager's failed send shouldn't block the rest
    }
  }

  const hrs = await User.find({ "roles.timesheet": "hr" });
  const hrsEmailed = [];
  if (allLines.length && hrs.length) {
    const body = approvalReminderBody("HR Team", allLines);
    for (const hr of hrs) {
      if (!hr.email) continue;
      try {
        await sendMail(hr.email, "Consolidated: Pending timesheets for approval", body);
        hrsEmailed.push(hr.email);
      } catch {
        // best-effort
      }
    }
  }

  return { pendingCount: pending.length, managersEmailed, hrsEmailed };
}

export function startTimesheetReminderJobs() {
  // Every Monday 12:30 IST — same schedule as the original APScheduler jobs.
  cron.schedule("30 12 * * 1", () => sendTimesheetReminders().catch(console.error), { timezone: "Asia/Kolkata" });
  cron.schedule("30 12 * * 1", () => sendApprovalReminders().catch(console.error), { timezone: "Asia/Kolkata" });
}
