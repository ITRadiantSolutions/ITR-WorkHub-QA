import mongoose from "mongoose";

export const ANNOUNCEMENT_CATEGORIES = ["company_news", "policy_update", "birthday", "general"];

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true, default: "" },
    category: { type: String, enum: ANNOUNCEMENT_CATEGORIES, default: "general" },
    isPinned: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },
    attachmentBlobName: { type: String, default: "" },
    attachmentFileName: { type: String, default: "" },
    acknowledgedBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        at: { type: Date, default: Date.now },
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

export default mongoose.model("Announcement", announcementSchema);
