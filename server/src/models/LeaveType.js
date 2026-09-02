import mongoose from "mongoose";

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, trim: true, default: "" },
    defaultDaysPerYear: { type: Number, default: 0 },
    accrualType: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    carryForwardMode: { type: String, enum: ["none", "half", "all", "fixed_cap"], default: "none" },
    carryForwardCap: { type: Number, default: 0 },
    requiresDocument: { type: Boolean, default: false },
    allowExcessAsLop: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export default mongoose.model("LeaveType", leaveTypeSchema);
