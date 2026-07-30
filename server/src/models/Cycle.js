import mongoose from "mongoose";

// The old system's `templates` collection (per-cycle form config: weight
// limit, quarter selection, auto-created flag) was a 1:1 companion to a
// cycle, fanned out into a second collection with a `selected` flag to mark
// the active one. Folding it in here as `formConfig` removes that collection
// and the "which template is active" bookkeeping entirely.
const cycleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, trim: true, default: null },
    start: { type: Date, required: true },
    end: { type: Date, required: true },

    employeeResponse: {
      enabled: { type: Boolean, default: false },
      expiry: { type: Date, default: null },
      durationDays: { type: Number, default: null },
      selectedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    },
    managerResponse: {
      enabled: { type: Boolean, default: false },
      expiry: { type: Date, default: null },
      durationDays: { type: Number, default: null },
      selectedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    },

    reportVisibility: {
      mode: { type: String, enum: ["none", "all", "selected"], default: "none" },
      visibleTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      visibleToHistory: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          changedAt: { type: Date, default: Date.now },
        },
      ],
    },

    reminders: {
      employeeReminderDays: { type: Number, default: 3 },
      managerReminderDays: { type: Number, default: 3 },
      lastEmployeeReminderDate: { type: Date, default: null },
      lastManagerReminderDate: { type: Date, default: null },
    },

    formConfig: {
      employeeWeightLimit: { type: Number, default: 100 },
      kras: { type: [mongoose.Schema.Types.Mixed], default: [] },
      selectedQuarters: { type: [String], default: [] },
      autoCreated: { type: Boolean, default: false },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

cycleSchema.index({ start: 1, end: 1 });

export default mongoose.model("Cycle", cycleSchema);
