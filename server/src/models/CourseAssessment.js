import mongoose from "mongoose";

const mcqOptionSchema = new mongoose.Schema({ text: { type: String, required: true } }, { _id: false });

const questionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["mcq", "text"], default: "mcq", required: true },
    prompt: { type: String, required: true },
    options: { type: [mcqOptionSchema], default: [] },
    correctOptionIndex: { type: Number, default: 0 },
  },
  { _id: false },
);

const courseAssessmentSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assessmentType: { type: String, enum: ["assignment", "quiz"], required: true },
    title: { type: String, required: true, trim: true },
    durationMinutes: { type: Number, required: true, min: 1 },
    questions: { type: [questionSchema], default: [] },
    isPublished: { type: Boolean, default: false },
    maxAttempts: { type: Number, default: 3, min: 1 },
    passingPercentage: { type: Number, default: 80, min: 0, max: 100 },
    skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", default: null },
    badge: { type: mongoose.Schema.Types.ObjectId, ref: "Badge", default: null },
  },
  { timestamps: true },
);

export default mongoose.model("CourseAssessment", courseAssessmentSchema);
