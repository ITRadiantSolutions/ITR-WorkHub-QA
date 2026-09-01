import mongoose from "mongoose";

const courseAssignmentSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    assignedAtByEmployee: { type: Map, of: Date, default: {} },
    statusByEmployee: { type: Map, of: String, default: {} },
    passingPercentageByEmployee: { type: Map, of: Number, default: {} },
  },
  { timestamps: true },
);

courseAssignmentSchema.index({ course: 1, assignedBy: 1 }, { unique: true });

export default mongoose.model("CourseAssignment", courseAssignmentSchema);
