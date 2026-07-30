import Notification from "../models/Notification.js";

// Fire-and-forget: a failed notification write should never fail the request
// that triggered it (matches Flow_Tracker's original behavior).
export async function notifyUsers(userIds, payload) {
  const recipients = [...new Set((userIds || []).filter(Boolean).map((id) => id.toString()))];
  if (!recipients.length) return;

  try {
    await Notification.insertMany(recipients.map((userId) => ({ userId, ...payload })));
  } catch (error) {
    console.error("notifyUsers failed:", error.message);
  }
}
