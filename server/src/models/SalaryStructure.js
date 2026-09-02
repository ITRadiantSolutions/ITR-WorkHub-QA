import mongoose from "mongoose";

const salaryStructureSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    components: [
      {
        name: { type: String, required: true, trim: true },
        type: { type: String, enum: ["earning", "contribution", "deduction"], required: true },
        amount: { type: Number, required: true, min: 0 },
      },
    ],
    grossEarnings: { type: Number, required: true, min: 0 },
    paymentMode: { type: String, enum: ["bank_transfer", "cash", "cheque"], default: "bank_transfer" },
    uan: { type: String, trim: true, default: "" },
    monthlySalary: { type: Number, default: 0, min: 0 },
    effectiveFrom: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export default mongoose.model("SalaryStructure", salaryStructureSchema);
