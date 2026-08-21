import mongoose from "mongoose";

// One current structure per employee (no version history yet) — HR updates
// it in place when compensation changes. Component amounts are HR-entered,
// never computed: PF/ESI/TDS slabs are compliance-sensitive and this module
// deliberately doesn't guess at them.
const salaryStructureSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    components: [
      {
        name: { type: String, required: true, trim: true },
        // "contribution" is for employer/employee statutory contributions
        // (e.g. PF) that payslips display in their own section, separate
        // from earnings and from tax-style deductions.
        type: { type: String, enum: ["earning", "contribution", "deduction"], required: true },
        amount: { type: Number, required: true, min: 0 },
      },
    ],
    // Payslip-header fields, not part of the earning/deduction math below —
    // HR-entered, shown as-is on the payslip.
    paymentMode: { type: String, enum: ["bank_transfer", "cash", "cheque"], default: "bank_transfer" },
    uan: { type: String, trim: true, default: "" },
    monthlySalary: { type: Number, default: 0, min: 0 },
    effectiveFrom: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export default mongoose.model("SalaryStructure", salaryStructureSchema);
