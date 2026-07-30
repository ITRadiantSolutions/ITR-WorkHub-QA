import mongoose from "mongoose";

const bugSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "Bug title is required"], trim: true, maxlength: [200, "Title cannot exceed 200 characters"] },
    description: { type: String, trim: true },
    severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "MEDIUM" },
    status: { type: String, enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "WONT_FIX"], default: "OPEN" },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: [true, "Task is required for bug report"] },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // File bytes are stored in Azure Blob Storage; only metadata is stored here.
    attachments: [
      {
        fileName: { type: String, trim: true },
        fileSize: { type: Number },
        mimeType: { type: String, trim: true },
        url: { type: String, trim: true },
        blobName: { type: String, trim: true },
        uploadedAt: { type: Date },
      },
    ],
  },
  { timestamps: true },
);

bugSchema.index({ reportedBy: 1, status: 1 });
bugSchema.index({ taskId: 1 });
bugSchema.index({ taskId: 1, createdAt: -1 });
bugSchema.index({ status: 1, severity: 1 });

export default mongoose.model("Bug", bugSchema);
