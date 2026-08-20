// Best-effort email layer for HRMS events, alongside the existing in-app
// Notification records — mirrors notifyUsers' "never break the caller's flow"
// contract. Reuses the same Graph app-only sender as timesheet reminders.
import { sendMail } from "./graphMailer.js";

const wrap = (title, bodyHtml) => `
<html><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px;">
<table width="100%" cellpadding="0" cellspacing="0" style="border-left:4px solid #0e7490;padding-left:16px;">
<tr><td style="font-size:14px;color:#111827;">
<p style="font-size:16px;font-weight:700;margin:0 0 12px;">${title}</p>
${bodyHtml}
</td></tr></table>
<p style="margin-top:16px;font-weight:600;color:#0e7490;">HRMS</p>
</td></tr></table></body></html>`;

export async function sendHrmsEmail(toEmail, subject, title, bodyHtml) {
  if (!toEmail) return;
  try {
    await sendMail(toEmail, subject, wrap(title, bodyHtml));
  } catch (error) {
    console.error("sendHrmsEmail failed:", error.message);
  }
}
