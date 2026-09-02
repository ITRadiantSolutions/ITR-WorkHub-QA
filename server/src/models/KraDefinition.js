import mongoose from "mongoose";

const kpiSchema = new mongoose.Schema(
  { title: String, description: String, weight: Number, target: mongoose.Schema.Types.Mixed, name: String },
  { _id: false },
);

const kraEntrySchema = new mongoose.Schema(
  {

    originalId: { type: mongoose.Schema.Types.ObjectId, default: null },
    name: String,
    type: { type: String, enum: ["functional", "organizational"], default: "functional" },
    weight: Number,
    kpis: { type: [kpiSchema], default: [] },
  },
  { _id: true },
);


const kraDefinitionSchema = new mongoose.Schema(
  {
    scope: { type: String, enum: ["library", "master_template"], required: true },
    type: { type: String, enum: ["functional", "organizational"], default: null },
    name: { type: String, trim: true, default: null },
    kras: { type: [kraEntrySchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "kra_definitions" },
);

kraDefinitionSchema.index({ scope: 1, type: 1 });

export default mongoose.model("KraDefinition", kraDefinitionSchema);
