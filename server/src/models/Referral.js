import mongoose from "mongoose";

const statusHistoryEntrySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    changedAt: { type: Date, default: Date.now },
    note: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const referralSchema = new mongoose.Schema(
  {
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: "JobPost", required: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    notes: { type: String, trim: true, default: "" },
    hrNotes: { type: String, trim: true, default: "" },

    status: {
      type: String,
      enum: ["submitted", "under_review", "shortlisted", "interview_scheduled", "selected", "rejected", "on_hold"],
      default: "submitted",
    },
    statusHistory: { type: [statusHistoryEntrySchema], default: [] },
  },
  { timestamps: true },
);

// A given candidate can't be referred twice for the same job.
referralSchema.index({ candidate: 1, job: 1 }, { unique: true });
referralSchema.index({ referredBy: 1, createdAt: -1 });
referralSchema.index({ job: 1, status: 1 });

export default mongoose.model("Referral", referralSchema);
