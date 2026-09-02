import mongoose from "mongoose";

const attendanceDaySchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true }, // "YYYY-MM-DD", local calendar day
    firstIn: { type: Date, default: null },
    lastOut: { type: Date, default: null },
    workedSeconds: { type: Number, default: 0 },
    punchCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["present", "half_day", "absent", "on_leave", "holiday", "weekend"],
      default: "absent",
    },
    isLate: { type: Boolean, default: false },
    isRegularized: { type: Boolean, default: false },
    regularizedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    regularizedAt: { type: Date, default: null },
    regularizationNote: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

attendanceDaySchema.index({ employee: 1, date: 1 }, { unique: true });
attendanceDaySchema.index({ date: 1, status: 1 });

export default mongoose.model("AttendanceDay", attendanceDaySchema);
