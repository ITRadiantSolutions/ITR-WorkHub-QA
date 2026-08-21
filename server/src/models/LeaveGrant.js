import mongoose from "mongoose";

// A manual balance credit HR grants outside the normal accrual — e.g. a
// Comp-Off day for weekend/holiday work, or an ad-hoc Election Day grant.
// Applies to the calendar year it's granted in (via createdAt), same as an
// accrual credit, and shows up as its own line in the leave ledger.
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
