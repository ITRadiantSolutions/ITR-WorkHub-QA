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
    // A request beyond the available balance isn't blocked — the excess
    // becomes unpaid (loss of pay) rather than rejecting the whole thing.
    // paidDays + lopDays === totalDays always.
    paidDays: { type: Number, required: true },
    lopDays: { type: Number, default: 0 },
    reason: { type: String, trim: true, default: "" },

    // Two-step chain: the reporting manager approves first (pending_manager),
    // then it routes to the manager's own manager for final sign-off
    // (pending_skip_level) — falling back to HR wherever a link is missing
    // (no manager at all, or the manager has no manager above them).
    status: {
      type: String,
      enum: ["pending_manager", "pending_skip_level", "approved", "rejected", "cancelled"],
      default: "pending_manager",
    },
    // The manager's approval at stage one — only set when the chain proceeds
    // to skip-level, since a manager rejection is terminal and captured below.
    managerDecision: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      at: { type: Date, default: null },
      comment: { type: String, trim: true, default: "" },
    },
    // Whoever made the terminal call — a rejection at either stage, or the
    // final approval (skip-level or HR override).
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
    decisionComment: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

leaveRequestSchema.index({ employee: 1, status: 1 });

export default mongoose.model("LeaveRequest", leaveRequestSchema);
