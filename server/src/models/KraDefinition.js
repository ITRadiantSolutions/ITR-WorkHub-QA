import mongoose from "mongoose";

const kpiSchema = new mongoose.Schema(
  // `name` is a fallback for migrated legacy data, which used `name` where we
  // use `title` — declared so Mongoose doesn't drop it on re-save.
  // `target` is set here by HR/manager; the employee fills in the matching
  // `actual` on their own KraAssignment.kras[].kpis[] copy during self-review
  // (this library entry is just the authoring source, resolved/snapshotted
  // into each template/assignment — see kraDefinitionController.resolveKraRefs).
  // Mixed, not Number/String — a target isn't always numeric ("Ship v2 by Q3" is as valid as "10").
  { title: String, description: String, weight: Number, target: mongoose.Schema.Types.Mixed, name: String },
  { _id: false },
);

const kraEntrySchema = new mongoose.Schema(
  {
    // For scope="master_template" entries, points back at the library KRA
    // this bundle entry was copied from (replaces a second `kra_master_templates`
    // collection referencing `kra_library` by `originalId`).
    originalId: { type: mongoose.Schema.Types.ObjectId, default: null },
    name: String,
    type: { type: String, enum: ["functional", "organizational"], default: "functional" },
    // Only meaningful for scope="master_template" entries — the weight this
    // bundle suggests for the KRA once assigned.
    weight: Number,
    kpis: { type: [kpiSchema], default: [] },
  },
  { _id: true },
);

// Merges the old kra_library (raw catalog, one doc per type) and
// kra_master_templates (named, curated bundles referencing the catalog)
// collections into one, distinguished by `scope`.
const kraDefinitionSchema = new mongoose.Schema(
  {
    scope: { type: String, enum: ["library", "master_template"], required: true },
    // Library docs: one per type ("functional"/"organizational").
    type: { type: String, enum: ["functional", "organizational"], default: null },
    // Master-template docs: a human-facing bundle name.
    name: { type: String, trim: true, default: null },

    kras: { type: [kraEntrySchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  // Explicit name: Mongoose's default pluralization ("kradefinitions") doesn't
  // match the "kra_definitions" collection the data migration wrote to.
  { timestamps: true, collection: "kra_definitions" },
);

kraDefinitionSchema.index({ scope: 1, type: 1 });

export default mongoose.model("KraDefinition", kraDefinitionSchema);
