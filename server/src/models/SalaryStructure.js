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
        type: { type: String, enum: ["earning", "deduction"], required: true },
        amount: { type: Number, required: true, min: 0 },
      },
    ],
    effectiveFrom: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export default mongoose.model("SalaryStructure", salaryStructureSchema);
