import mongoose from "mongoose";

const mcqOptionSchema = new mongoose.Schema({ text: { type: String, required: true } }, { _id: false });

// Unlike CourseAssessment's questionSchema, this keeps its own _id — the
// server needs to reference specific pool questions when sampling an
// attempt's subset and grading against exactly those ids.
const testQuestionSchema = new mongoose.Schema({
  type: { type: String, enum: ["mcq", "fill_blank"], default: "mcq", required: true },
  prompt: { type: String, required: true, trim: true },
  // mcq only
  options: { type: [mcqOptionSchema], default: [] },
  correctOptionIndex: { type: Number, default: 0 },
  // fill_blank only — case-insensitive/trimmed match against any of these
  acceptableAnswers: { type: [String], default: [] },
});

const skillTestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    durationMinutes: { type: Number, required: true, min: 1 },

    questionPool: { type: [testQuestionSchema], default: [] },
    // How many questions are sampled from questionPool per attempt —
    // validated <= questionPool.length in the controller.
    attemptSize: { type: Number, required: true, min: 1 },
    maxAttempts: { type: Number, default: 3, min: 1 },
    passingPercentage: { type: Number, default: 80, min: 0, max: 100 },

    skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", default: null },
    badge: { type: mongoose.Schema.Types.ObjectId, ref: "Badge", default: null },
    isPublished: { type: Boolean, default: false },

    // Many-to-many — eligibility is computed live against SkillGroup.members
    // at request time, not snapshotted at assign time.
    skillGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: "SkillGroup" }],
  },
  { timestamps: true },
);

export default mongoose.model("SkillTest", skillTestSchema);
