import CourseReview from "../models/CourseReview.js";
import Course from "../models/Course.js";

// Ported from the standalone LMS project's reviewController.js.

export const addReview = async (req, res) => {
  const { rating, comment, courseId } = req.body;
  const userId = req.user._id;

  const course = await Course.findById(courseId);
  if (!course) return res.status(404).json({ message: "Course not found" });

  const alreadyReviewed = await CourseReview.findOne({ course: courseId, user: userId });
  if (alreadyReviewed) return res.status(400).json({ message: "You have already reviewed this course" });

  const review = await CourseReview.create({ course: courseId, user: userId, rating, comment });
  course.reviews.push(review._id);
  await course.save();

  res.status(201).json(review);
};

export const getCourseReviews = async (req, res) => {
  const reviews = await CourseReview.find({ course: req.params.courseId });
  res.json(reviews);
};

export const getAllReviews = async (req, res) => {
  const reviews = await CourseReview.find({}).populate("user", "name").sort({ reviewedAt: -1 });
  res.json(reviews);
};
