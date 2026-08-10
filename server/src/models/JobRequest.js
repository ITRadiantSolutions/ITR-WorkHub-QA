import mongoose from "mongoose";

// A manager's ask for a new opening, routed to HR for review. Kept separate
// from JobPost (the HR-published, employee-visible listing) — approving a
// request creates a JobPost, it doesn't become one in place.
const clarificationSchema = new mongoose.Schema(
  {
    askedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    question: { type: String, trim: true, required: true },
    askedAt: { type: Date, default: Date.now },
    response: { type: String, trim: true, default: "" },
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    respondedAt: { type: Date, default: null },
  },
  { _id: true },
);

const jobRequestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    department: { type: String, trim: true, default: "" },
    positions: { type: Number, default: 1 },
    location: { type: String, trim: true, default: "" },
    employmentType: {
      type: String,
      enum: ["Full-time", "Part-time", "Contract", "Intern"],
      default: "Full-time",
    },
    experienceRequired: { type: String, trim: true, default: "" },
    skillsRequired: [{ type: String, trim: true }],
    skillsPreferred: [{ type: String, trim: true }],
    salaryRangeMin: { type: Number, default: null },
    salaryRangeMax: { type: Number, default: null },
    description: { type: String, trim: true, default: "" },
    businessJustification: { type: String, trim: true, default: "" },
    priority: { type: String, enum: ["Low", "Medium", "High", "Urgent"], default: "Medium" },
    targetHiringDate: { type: Date, default: null },

    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    status: {
      type: String,
      enum: ["draft", "submitted", "under_review", "clarification_required", "approved", "rejected", "published"],
      default: "draft",
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, default: "" },

    clarifications: { type: [clarificationSchema], default: [] },

    publishedJobPost: { type: mongoose.Schema.Types.ObjectId, ref: "JobPost", default: null },
  },
  { timestamps: true },
);

jobRequestSchema.index({ requestedBy: 1, createdAt: -1 });
jobRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("JobRequest", jobRequestSchema);
