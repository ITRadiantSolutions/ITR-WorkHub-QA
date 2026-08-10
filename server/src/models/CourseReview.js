import mongoose from "mongoose";

// Renamed from the source project's `Review` model — disambiguates from any
// other review-type model elsewhere in the unified platform.
const courseReviewSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
    reviewedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.model("CourseReview", courseReviewSchema);
