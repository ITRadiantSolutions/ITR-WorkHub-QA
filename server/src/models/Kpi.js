import mongoose from "mongoose";

// A KPI attached to a draft Kra (see Kra.js) — cleared alongside its parent
// once the employee publishes the draft via POST /api/kras/submit-template.
const kpiSchema = new mongoose.Schema(
  {
    kraId: { type: mongoose.Schema.Types.ObjectId, ref: "Kra", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    weight: { type: Number, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } },
);

kpiSchema.index({ kraId: 1 });

export default mongoose.model("Kpi", kpiSchema);
