import mongoose from "mongoose";

const kpiSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    weight: Number,
    // Target is set by HR/manager when authoring the KPI; actual is filled
    // in by the employee during self-review. Both are Mixed — a target/
    // actual isn't always a number ("Ship v2 by Q3" is as valid as "10").
    target: mongoose.Schema.Types.Mixed,
    actual: mongoose.Schema.Types.Mixed,
    // `name`/`localId` come from migrated legacy data (the old system used
    // `name` where we use `title`) — declared here so Mongoose doesn't
    // silently drop them the first time a migrated document is re-saved
    // through this schema.
    name: String,
    localId: String,
  },
  { _id: false },
);

const assignedKraSchema = new mongoose.Schema(
  {
    defRef: { type: mongoose.Schema.Types.ObjectId, default: null }, // KraDefinition entry this came from
    name: String,
    type: { type: String, enum: ["functional", "organizational"], default: "functional" },
    weight: Number,
    kpis: { type: [kpiSchema], default: [] },
    // Distinguishes HR/manager-assigned ("base") KRAs from ones an employee
    // drafted themselves, which need manager approval before they count
    // toward the 100% weight total.
    isEmployeeAdded: { type: Boolean, default: false },
  },
  { _id: true },
);

// Was `kpi_templates` — the actual per-user-per-cycle KRA assignment record.
// Renamed since "kpi_templates" was confusingly named for what it actually is.
// Group assignments are still expanded into one document per member at
// creation time (see kraAssignmentController.assignToGroup) rather than
// stored relationally, matching the old behavior.
const kraAssignmentSchema = new mongoose.Schema(
  {
    // Not `required`: some migrated legacy assignments have no resolvable
    // cycle reference.
    cycleId: { type: mongoose.Schema.Types.ObjectId, ref: "Cycle", default: null },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "KraDefinition", default: null },

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    kras: { type: [assignedKraSchema], default: [] },

    status: { type: String, default: "draft" },
    submittedAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  // Explicit name: Mongoose's default pluralization ("kraassignments") doesn't
  // match the "kra_assignments" collection the data migration wrote to.
  { timestamps: true, collection: "kra_assignments" },
);

kraAssignmentSchema.index({ cycleId: 1, assignedTo: 1 });
kraAssignmentSchema.index({ templateId: 1 });

export default mongoose.model("KraAssignment", kraAssignmentSchema);
