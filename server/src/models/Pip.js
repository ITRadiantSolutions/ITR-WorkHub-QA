import mongoose from "mongoose";

const goalSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    successMeasure: { type: String, trim: true, default: "" },
    progressStatus: { type: String, default: "not_started" },
    checkpointDate: {
      type: Date,
      default: null,
      validate: {
        validator: (v) => v === null || v.getFullYear() <= 2100,
        message: "checkpointDate year is out of range",
      },
    },
    proofDocuments: [{ blobName: String, fileName: String, uploadedAt: { type: Date, default: Date.now } }],
    notes: { type: String, trim: true, default: "" },
  },
  { _id: true },
);

const pipSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["active", "completed", "extended", "cancelled"],
      default: "active",
    },
    outcome: { type: String, default: null },
    startDate: { type: Date, required: true },
    targetEndDate: { type: Date, required: true },
    reason: { type: String, trim: true, default: "" },
    reviewNotes: { type: String, trim: true, default: "" },

    goals: { type: [goalSchema], default: [] },

    employeeSubmitted: { type: Boolean, default: false },
    submittedManagerName: { type: String, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

pipSchema.index({ employeeId: 1, status: 1 });

export default mongoose.model("Pip", pipSchema);
