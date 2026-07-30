import ActivityLog from "../models/ActivityLog.js";

// Best-effort — logging must never break the request/flow it's observing.
export async function writeAuditLog(fields) {
  try {
    await ActivityLog.create({ logType: "audit", ...fields });
  } catch (error) {
    console.error("writeAuditLog failed:", error.message);
  }
}

export async function logMsLoginStep(email, step, fields = {}) {
  try {
    await ActivityLog.create({ logType: "ms_login", msLogin: { email, step, ...fields } });
  } catch (error) {
    console.error("logMsLoginStep failed:", error.message);
  }
}
