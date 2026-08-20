import mongoose from "mongoose";

const assetAssignmentSchema = new mongoose.Schema(
  {
    asset: { type: mongoose.Schema.Types.ObjectId, ref: "Asset", required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: ["active", "returned"], default: "active" },
    returnedAt: { type: Date, default: null },
    returnCondition: { type: String, enum: ["new", "good", "fair", "damaged", null], default: null },
    returnNotes: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

export default mongoose.model("AssetAssignment", assetAssignmentSchema);
