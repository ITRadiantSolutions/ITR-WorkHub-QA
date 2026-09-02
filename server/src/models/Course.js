import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subTitle: { type: String, trim: true, default: "" },
    description: { type: String, default: "" },
    category: { type: String, required: true, trim: true },
    level: { type: String, enum: ["Beginner", "Intermediate", "Advanced"], default: "Beginner" },
    thumbnail: { type: String, default: "" },
    enrolledStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    lectures: [{ type: mongoose.Schema.Types.ObjectId, ref: "Lecture" }],
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isPublished: { type: Boolean, default: false },
    reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: "CourseReview" }],
  },
  { timestamps: true },
);

courseSchema.index({ isPublished: 1, category: 1 });

export default mongoose.model("Course", courseSchema);
