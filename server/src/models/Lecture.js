import mongoose from "mongoose";

// `materials[].fileUrl` stores a blob name (see Course.js's comment on
// thumbnail — same signed-URL-on-read pattern).
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
    test: {
      enabled: { type: Boolean, default: false },
      questions: { type: mongoose.Schema.Types.Mixed, default: [] },
    },
  },
  { timestamps: true },
);

export default mongoose.model("Lecture", lectureSchema);
