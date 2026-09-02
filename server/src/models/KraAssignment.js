import mongoose from "mongoose";

const kpiSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    weight: Number,
    target: mongoose.Schema.Types.Mixed,
    actual: mongoose.Schema.Types.Mixed,
    name: String,
    localId: String,
  },
  { _id: false },
);

const assignedKraSchema = new mongoose.Schema(
  {
    defRef: { type: mongoose.Schema.Types.ObjectId, default: null }, 
    name: String,
    type: { type: String, enum: ["functional", "organizational"], default: "functional" },
    weight: Number,
    kpis: { type: [kpiSchema], default: [] },
    isEmployeeAdded: { type: Boolean, default: false },
  },
  { _id: true },
);

 
const kraAssignmentSchema = new mongoose.Schema(
  {
 
    cycleId: { type: mongoose.Schema.Types.ObjectId, ref: "Cycle", default: null },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "KraDefinition", default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    kras: { type: [assignedKraSchema], default: [] },
    status: { type: String, default: "draft" },
    submittedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },

  { timestamps: true, collection: "kra_assignments" },
);

kraAssignmentSchema.index({ cycleId: 1, assignedTo: 1 });
kraAssignmentSchema.index({ templateId: 1 });

export default mongoose.model("KraAssignment", kraAssignmentSchema);
