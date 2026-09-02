import mongoose from "mongoose";

const leaveRequestLockSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  leaveType: { type: mongoose.Schema.Types.ObjectId, ref: "LeaveType", required: true },
  createdAt: { type: Date, default: Date.now, expires: 30 },
});

leaveRequestLockSchema.index({ employee: 1, leaveType: 1 }, { unique: true });

export default mongoose.model("LeaveRequestLock", leaveRequestLockSchema);
