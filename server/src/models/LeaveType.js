import mongoose from "mongoose";

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, trim: true, default: "" },
    defaultDaysPerYear: { type: Number, default: 0 },
    // Max unused days that roll into the next calendar year; the rest lapses
    // on Dec 31. 0 means no carry-forward.
    carryForwardCap: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export default mongoose.model("LeaveType", leaveTypeSchema);
