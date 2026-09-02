import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    logType: { type: String, enum: ["audit", "ms_login"], required: true, index: true },

    // --- audit fields ---
    type: { type: String, enum: ["api", "change", "database", "cloud", "server", "audit", "deployment"], default: "api", index: true },
    level: { type: String, enum: ["info", "warn", "error"], default: "info", index: true },
    event: { type: String, trim: true },
    action: { type: String, trim: true, index: true },
    method: { type: String, trim: true },
    path: { type: String, trim: true, index: true },
    route: { type: String, trim: true },
    statusCode: { type: Number, index: true },
    success: { type: Boolean, index: true },
    durationMs: Number,
    cacheStatus: { type: String, enum: ["HIT", "MISS", "BYPASS"] },

    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    actorName: { type: String, trim: true, index: true },
    actorEmail: { type: String, trim: true, lowercase: true },
    actorRole: { type: String, trim: true, index: true },
    actorPmsRole: { type: String, trim: true, index: true },

    ip: String,
    userAgent: String,
    requestId: { type: String, trim: true, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    projectId: { type: String, trim: true, default: "" },
    projectName: { type: String, trim: true, default: "" },
    ticketNo: { type: String, trim: true, default: "" },
    targetId: { type: String, trim: true, index: true },
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    changes: mongoose.Schema.Types.Mixed,
    error: { name: String, message: String, code: mongoose.Schema.Types.Mixed },
    provider: String,

    deployment: {
      deploymentId: { type: String, index: true },
      provider: String,
      siteName: String,
      version: String,
      environment: String,
      status: { type: String, enum: ["starting", "running", "stopped", "failed"] },
      deployedAt: Date,
      startedAt: Date,
      readyAt: Date,
      stoppedAt: Date,
      lastHeartbeatAt: Date,
      startupDurationMs: Number,
      downtimeMs: Number,
      port: Number,
      host: String,
    },

    // --- ms_login fields (only populated when logType === "ms_login") ---
    msLogin: {
      email: String,
      status: { type: String, enum: ["success", "failed", "pending"] },
      step: {
        type: String,
        enum: [
          "button_click", "redirect_start", "azure_callback", "token_received",
          "profile_fetched", "user_found", "user_created", "approval_check",
          "jwt_generated", "final_redirect",
        ],
      },
      errorCode: String,
      browser: String,
      device: String,
      loginTime: Date,
      callbackTime: Date,
      sessionDuration: Number,
      microsoftId: String,
      approvalStatus: String,
    },
  },
  { collection: "activity_logs", timestamps: true, strict: false },
);

activityLogSchema.index({ logType: 1, createdAt: -1 });
activityLogSchema.index({ type: 1, createdAt: -1 });
activityLogSchema.index({ actorRole: 1, createdAt: -1 });
activityLogSchema.index({ success: 1, createdAt: -1 });
activityLogSchema.index({ "msLogin.email": 1, createdAt: -1 });
activityLogSchema.index({ "msLogin.status": 1, "msLogin.step": 1, createdAt: -1 });

export default mongoose.models.ActivityLog || mongoose.model("ActivityLog", activityLogSchema);
