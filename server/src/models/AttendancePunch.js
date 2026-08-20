import mongoose from "mongoose";

// One raw scan event, from a biometric device connector (e.g. the eSSL/ZKTeco
// iClock ADMS connector) or entered manually by HR. AttendanceDay rollups are
// derived from these; punches themselves are never edited, only added to —
// this keeps a full audit trail even after a day gets regularized.
const attendancePunchSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    // Kept even when unmatched so HR can see and fix the mapping later
    // without losing the punch (mirrors the connector's own "unmapped" state).
    employeeCode: { type: String, trim: true, default: "" },
    timestamp: { type: Date, required: true },
    direction: { type: String, enum: ["IN", "OUT", "UNKNOWN"], default: "UNKNOWN" },
    source: { type: String, trim: true, default: "MANUAL" },
    deviceSerial: { type: String, trim: true, default: "" },
    devicePin: { type: String, trim: true, default: "" },
    verifyMode: { type: String, trim: true, default: "" },
    // Set for device pushes so retried/duplicate pushes are no-ops; left null
    // for manual entries, which have no natural dedup key.
    dedupKey: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

attendancePunchSchema.index({ dedupKey: 1 }, { unique: true, sparse: true });
attendancePunchSchema.index({ employee: 1, timestamp: 1 });

export default mongoose.model("AttendancePunch", attendancePunchSchema);
