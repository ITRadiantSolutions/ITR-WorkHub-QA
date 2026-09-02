import mongoose from "mongoose";

const payslipSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    components: [
      {
        name: { type: String, required: true, trim: true },
        type: { type: String, enum: ["earning", "contribution", "deduction"], required: true },
        amount: { type: Number, required: true },
      },
    ],
    grossEarnings: { type: Number, required: true },
    totalContributions: { type: Number, default: 0 },
    totalDeductions: { type: Number, required: true },
    netPay: { type: Number, required: true },
    employeeNumber: { type: String, default: "" },
    department: { type: String, default: "" },
    designation: { type: String, default: "" },
    location: { type: String, default: "" },
    paymentMode: { type: String, default: "bank_transfer" },
    uan: { type: String, default: "" },
    panNumber: { type: String, default: "" },
    dateOfBirth: { type: Date, default: null },
    monthlySalary: { type: Number, default: 0 },
    totalWorkingDays: { type: Number, default: 0 },
    lossOfPayDays: { type: Number, default: 0 },
    actualPayableDays: { type: Number, default: 0 },
    daysPayable: { type: Number, default: 0 },
    status: { type: String, enum: ["generated", "paid"], default: "generated" },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

payslipSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model("Payslip", payslipSchema);
