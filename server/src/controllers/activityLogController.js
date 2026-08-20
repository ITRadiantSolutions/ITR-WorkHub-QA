import mongoose from "mongoose";
import ActivityLog from "../models/ActivityLog.js";
import { escapeRegex } from "../utils/taskFilters.js";

const processStartedAt = new Date();
const DB_STATES = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };

const requireAdmin = (req, res) => {
  if (req.user.roles.tracker !== "ADMIN") {
    res.status(403).json({ message: "Admin access required" });
    return false;
  }
  return true;
};

export const listActivityLogs = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const filter = {};
  if (req.query.logType) filter.logType = req.query.logType;
  if (req.query.level) filter.level = req.query.level;
  if (req.query.actorId) {
    if (!mongoose.Types.ObjectId.isValid(req.query.actorId)) {
      return res.status(400).json({ message: "Invalid actorId" });
    }
    filter.actorId = req.query.actorId;
  }

  const logs = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(500);
  res.json(logs);
};

// Combined admin logs + service health + deployment info for the Admin Logs page.
export const getAdminLogsSummary = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 2000) : 500;

  const filter = { logType: "audit" };
  if (req.query.type) filter.type = req.query.type;
  if (req.query.level) filter.level = req.query.level;
  if (req.query.statusCode) filter.statusCode = Number(req.query.statusCode);

  const logs = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();

  const apiLogs = logs.filter((log) => log.type === "api");
  const successfulApis = apiLogs.filter((log) => Number(log.statusCode) < 400).length;
  const failedApis = apiLogs.filter((log) => Number(log.statusCode) >= 500).length;
  const adminPmChanges = logs.filter((log) => log.type === "change").length;

  res.setHeader("Cache-Control", "no-store");
  res.json({
    success: true,
    generatedAt: new Date().toISOString(),
    services: {
      database: DB_STATES[mongoose.connection.readyState] || "unknown",
      azureBlobStorage:
        process.env.STORAGE_CONNECTION_STRING ||
        (process.env.STORAGE_ACCOUNT_NAME && process.env.STORAGE_ACCOUNT_KEY)
          ? "configured"
          : "not_configured",
    },
    summary: {
      totalRecords: logs.length,
      apiCalls: apiLogs.length,
      successfulApis,
      failedApis,
      adminPmChanges,
    },
    deployment: {
      status: "running",
      startedAt: processStartedAt.toISOString(),
      uptimeMs: Date.now() - processStartedAt.getTime(),
    },
    filters: { limit, type: req.query.type || null, level: req.query.level || null },
    count: logs.length,
    logs,
  });
};

const ACCESS_GRANT_EVENTS = [
  "user.moduleAccess.updated",
  "user.manageAccessGrant.updated",
  "user.superAdmin.granted",
  "user.superAdmin.revoked",
  "user.role.updated",
  "user.archive.updated",
];

// Super admin only — the Audit Logs tab on Access Grants. Scoped to just
// the events that page can cause (module access grants + super admin
// grant/revoke), not the full admin log firehose.
export const getAccessGrantAuditLogs = async (req, res) => {
  if (!req.user.isSuperAdmin) {
    return res.status(403).json({ message: "Only a super admin can view this log." });
  }
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 1000) : 500;

  const logs = await ActivityLog.find({ logType: "audit", event: { $in: ACCESS_GRANT_EVENTS } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  res.setHeader("Cache-Control", "no-store");
  res.json({ logs });
};

export const getMicrosoftLoginLogs = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { page = 1, limit = 50, email, step, status } = req.query;

  const filter = { logType: "ms_login" };
  if (email) filter["msLogin.email"] = { $regex: escapeRegex(String(email)), $options: "i" };
  if (step) filter["msLogin.step"] = step;
  if (status) filter["msLogin.status"] = status;

  const [logs, total] = await Promise.all([
    ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean(),
    ActivityLog.countDocuments(filter),
  ]);

  res.json({
    message: "Microsoft login logs fetched successfully",
    data: logs.map((log) => ({
      id: log._id,
      email: log.msLogin?.email,
      step: log.msLogin?.step,
      status: log.msLogin?.status || "pending",
      ip: log.ip,
      browser: log.msLogin?.browser,
      createdAt: log.createdAt,
    })),
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
  });
};

export const getMicrosoftLoginErrors = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { page = 1, limit = 20, email, error } = req.query;

  const filter = { logType: "ms_login", "msLogin.status": "failed" };
  if (email) filter["msLogin.email"] = { $regex: escapeRegex(String(email)), $options: "i" };
  if (error) filter.error = { $regex: escapeRegex(String(error)), $options: "i" };

  const [logs, total, errorStats] = await Promise.all([
    ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean(),
    ActivityLog.countDocuments(filter),
    ActivityLog.aggregate([
      { $match: filter },
      { $group: { _id: "$msLogin.errorCode", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  res.json({
    message: "Microsoft login errors fetched successfully",
    data: logs.map((log) => ({
      id: log._id,
      email: log.msLogin?.email,
      step: log.msLogin?.step,
      error: log.error?.message,
      errorCode: log.msLogin?.errorCode,
      createdAt: log.createdAt,
    })),
    stats: { totalErrors: total, topErrors: errorStats },
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
  });
};
