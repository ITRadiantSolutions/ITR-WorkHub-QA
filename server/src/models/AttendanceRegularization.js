import mongoose from "mongoose";

// An employee's self-service request to correct a day's attendance (e.g. a
// missed device scan) — approved by their manager, falling back to HR when
// there's no manager, same shape as Expense's single-step review flow. On
// approval this writes into AttendanceDay; on rejection nothing changes.
const attendanceRegularizationSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    requestedStatus: {
      type: String,
      enum: ["present", "half_day", "absent", "on_leave", "holiday", "weekend"],
      required: true,
    },
    requestedFirstIn: { type: Date, default: null },
    requestedLastOut: { type: Date, default: null },
    reason: { type: String, trim: true, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
    decisionComment: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

attendanceRegularizationSchema.index({ employee: 1, date: 1, status: 1 });

export default mongoose.model("AttendanceRegularization", attendanceRegularizationSchema);
