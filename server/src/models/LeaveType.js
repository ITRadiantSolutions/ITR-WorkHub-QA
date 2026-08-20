import mongoose from "mongoose";

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, trim: true, default: "" },
    defaultDaysPerYear: { type: Number, default: 0 },
    // "yearly" grants the full annual quota in one lump on Jan 1 (or the
    // employee's joining date if later); "monthly" pro-rates it across the
    // months elapsed. Matches how real HR policies split leave types — e.g.
    // Sick/Paid often accrue monthly, Bereavement/Comp-off are full-quota.
    accrualType: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    // Max unused days that roll into the next calendar year; the rest lapses
    // on Dec 31. 0 means no carry-forward.
    carryForwardCap: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export default mongoose.model("LeaveType", leaveTypeSchema);
