import mongoose from "mongoose";

const materialSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["pdf", "video", "videoLink"], required: true },
    fileUrl: { type: String, default: "" },
    videoLink: { type: String, default: "" },
    title: { type: String, default: "" },
  },
  { _id: true },
);

const lectureSchema = new mongoose.Schema(
  {
    chapterTitle: { type: String, default: "" },
    lectureTitle: { type: String, required: true, trim: true },
    materials: { type: [materialSchema], default: [] },
    isPreviewFree: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model("Lecture", lectureSchema);
