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

    // Point of contact — carried over from TimeFlow's project record.
    poc: {
      name: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, lowercase: true, default: "" },
      phone: { type: String, trim: true, default: "" },
    },

    projectLead: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Replaces the old team_members collection's name-string project list.
    teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Carried over from TimeFlow's project_holidays.py (was embedded on the
    // project document there too). Extra holiday dates specific to this
    // project, on top of the company-wide calendar.
    holidays: [{ type: String }],
    // Company-wide holiday dates this project opts OUT of — e.g. a US
    // client's project that stays open on an India-only public holiday.
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
