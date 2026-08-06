import mongoose from "mongoose";

// A self-service KRA an employee is still drafting, before they publish it
// into a KraAssignment via POST /api/kras/submit-template. Distinct from
// KraDefinition/KraAssignment, which are HR/manager-assigned — this is the
// employee's own scratch workspace (mirrors ITR_TimeFlow_Production's
// separate `kras`/`kpis` collections).
const kraSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cycleId: { type: mongoose.Schema.Types.ObjectId, ref: "Cycle", default: null },
    name: { type: String, required: true, trim: true },
    weight: { type: Number, required: true },
    status: { type: String, enum: ["draft"], default: "draft" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } },
);

kraSchema.index({ userId: 1, status: 1 });

export default mongoose.model("Kra", kraSchema);
