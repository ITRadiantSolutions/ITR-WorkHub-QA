import mongoose from "mongoose";

const jobPostSchema = new mongoose.Schema(
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
    priority: { type: String, enum: ["Low", "Medium", "High", "Urgent"], default: "Medium" },
    applicationDeadline: { type: Date, default: null },

    status: {
      type: String,
      enum: ["draft", "published", "closed", "archived"],
      default: "draft",
    },

    sourceJobRequest: { type: mongoose.Schema.Types.ObjectId, ref: "JobRequest", default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    publishedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

jobPostSchema.index({ status: 1, createdAt: -1 });
jobPostSchema.index({ department: 1 });

export default mongoose.model("JobPost", jobPostSchema);
