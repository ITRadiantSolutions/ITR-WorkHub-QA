import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    fileName: String,
    storedName: String,
    blobName: String,
    fileMime: String,
    fileSize: Number,
    fileUrl: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },

    status: {
      type: String,
      enum: ["Planning", "Active", "Completed"],
      default: "Planning",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },

    startDate: Date,
    endDate: Date,

    poc: {
      name: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, lowercase: true, default: "" },
      phone: { type: String, trim: true, default: "" },
    },

    projectLead: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    holidays: [{ type: String }],
    excludedHolidays: [{ type: String }],
    attachments: [attachmentSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

projectSchema.index({ name: 1 });
projectSchema.index({ createdBy: 1, createdAt: -1 });
projectSchema.index({ projectLead: 1, createdAt: -1 });
projectSchema.index({ teamMembers: 1, createdAt: -1 });
projectSchema.index({ status: 1, priority: 1, createdAt: -1 });

export default mongoose.model("Project", projectSchema);
