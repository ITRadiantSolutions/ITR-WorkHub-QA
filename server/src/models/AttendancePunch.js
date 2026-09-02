import mongoose from "mongoose";

const attendancePunchSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    employeeCode: { type: String, trim: true, default: "" },
    timestamp: { type: Date, required: true },
    direction: { type: String, enum: ["IN", "OUT", "UNKNOWN"], default: "UNKNOWN" },
    source: { type: String, trim: true, default: "MANUAL" },
    deviceSerial: { type: String, trim: true, default: "" },
    devicePin: { type: String, trim: true, default: "" },
    verifyMode: { type: String, trim: true, default: "" },
    dedupKey: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

attendancePunchSchema.index({ dedupKey: 1 }, { unique: true, sparse: true });
attendancePunchSchema.index({ employee: 1, timestamp: 1 });

export default mongoose.model("AttendancePunch", attendancePunchSchema);
