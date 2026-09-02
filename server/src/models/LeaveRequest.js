import mongoose from "mongoose";

// totalDays now counts working days only — weekends and TimeFlow's company
// holiday calendar are excluded (see countWorkingDays in the controller).
const leaveRequestSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    leaveType: { type: mongoose.Schema.Types.ObjectId, ref: "LeaveType", required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isHalfDay: { type: Boolean, default: false },
    halfDaySession: { type: String, enum: ["first_half", "second_half", null], default: null },
    totalDays: { type: Number, required: true },
    paidDays: { type: Number, required: true },
    lopDays: { type: Number, default: 0 },
    reason: { type: String, trim: true, default: "" },
    appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    documentBlobName: { type: String, default: "" },
    documentFileName: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending_manager", "pending_skip_level", "approved", "rejected", "cancelled"],
      default: "pending_manager",
    },
    managerDecision: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      at: { type: Date, default: null },
      comment: { type: String, trim: true, default: "" },
    },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
    decisionComment: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

leaveRequestSchema.index({ employee: 1, status: 1 });

export default mongoose.model("LeaveRequest", leaveRequestSchema);
