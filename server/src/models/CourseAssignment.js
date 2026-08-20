import mongoose from "mongoose";

// Renamed from the source project's `Assignment` model to avoid clashing with
// LMS's separate course-assessment "assignment" concept (see CourseAssessment.js).
const courseAssignmentSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    assignedAtByEmployee: { type: Map, of: Date, default: {} },
    statusByEmployee: { type: Map, of: String, default: {} },
    // Minimum passing % the assigning manager set for each employee, overriding
    // CourseAssessment.passingPercentage for that employee's attempts on this course.
    passingPercentageByEmployee: { type: Map, of: Number, default: {} },
  },
  { timestamps: true },
);

courseAssignmentSchema.index({ course: 1, assignedBy: 1 }, { unique: true });

export default mongoose.model("CourseAssignment", courseAssignmentSchema);
