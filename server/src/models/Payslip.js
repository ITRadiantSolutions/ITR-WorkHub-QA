import mongoose from "mongoose";

// A snapshot of the employee's SalaryStructure at generation time — later
// edits to the structure must never retroactively change an issued payslip.
const payslipSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    components: [
      {
        name: { type: String, required: true, trim: true },
        type: { type: String, enum: ["earning", "deduction"], required: true },
        amount: { type: Number, required: true },
      },
    ],
    grossEarnings: { type: Number, required: true },
    totalDeductions: { type: Number, required: true },
    netPay: { type: Number, required: true },
    status: { type: String, enum: ["generated", "paid"], default: "generated" },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

payslipSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model("Payslip", payslipSchema);
