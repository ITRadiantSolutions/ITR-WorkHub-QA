import mongoose from "mongoose";

const leaveGrantSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    leaveType: { type: mongoose.Schema.Types.ObjectId, ref: "LeaveType", required: true },
    days: { type: Number, required: true, min: 0.5 },
    reason: { type: String, trim: true, default: "" },
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

leaveGrantSchema.index({ employee: 1, leaveType: 1 });

export default mongoose.model("LeaveGrant", leaveGrantSchema);
