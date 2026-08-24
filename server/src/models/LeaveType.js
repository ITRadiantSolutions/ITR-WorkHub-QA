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
    // How much of the unused balance rolls into the next calendar year (the
    // rest lapses on Dec 31): none of it, half of it, all of it, or capped at
    // carryForwardCap days (only meaningful for "fixed_cap").
    carryForwardMode: { type: String, enum: ["none", "half", "all", "fixed_cap"], default: "none" },
    carryForwardCap: { type: Number, default: 0 },
    // e.g. Sick Leave requiring a medical certificate — enforced at request
    // submission time, for both self-service and HR-on-behalf requests.
    requiresDocument: { type: Boolean, default: false },
    // Whether a self-service request beyond the remaining balance is allowed
    // to go through with the excess marked unpaid (loss of pay), or is
    // blocked outright. True matches the general accrual-based types (Paid,
    // Sick) — false is for fixed-quota event leave (Bereavement, Election
    // Day, Paternity) where "borrowing" days via LOP isn't meant to happen.
    allowExcessAsLop: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export default mongoose.model("LeaveType", leaveTypeSchema);
