import mongoose from "mongoose";

const rowSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    task: { type: String, trim: true, default: "" },
    // One entry per day, Mon..Sun.
    secs: { type: [Number], default: () => Array(7).fill(0) },
    nsa: { type: [Boolean], default: () => Array(7).fill(false) },
    comment: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const timesheetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },

    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "rejected", "needs_edit"],
      default: "draft",
    },

    rows: { type: [rowSchema], default: [] },
    comment: { type: String, trim: true, default: "" },

    submittedAt: { type: Date, default: null },
    managerActionBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    managerActionAt: { type: Date, default: null },
    managerComment: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

timesheetSchema.index({ userId: 1, weekStart: 1 }, { unique: true });
timesheetSchema.index({ managerId: 1, status: 1 });
timesheetSchema.index({ status: 1, createdAt: -1 });
timesheetSchema.index({ userId: 1, status: 1 });

timesheetSchema.methods.totalSeconds = function () {
  return this.rows.reduce(
    (sum, row) => sum + (row.secs || []).reduce((a, b) => a + (b || 0), 0),
    0,
  );
};

export default mongoose.model("Timesheet", timesheetSchema);
