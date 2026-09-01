import mongoose from "mongoose";

const mcqOptionSchema = new mongoose.Schema({ text: { type: String, required: true } }, { _id: false });

export const DEFAULT_GRADE_BANDS = [
  { label: "Expert", minPercent: 90 },
  { label: "Proficient", minPercent: 75 },
  { label: "Intermediate", minPercent: 50 },
  { label: "Beginner", minPercent: 25 },
  { label: "Needs Revision", minPercent: 0 },
];

const testQuestionSchema = new mongoose.Schema({
  type: { type: String, enum: ["mcq", "fill_blank"], default: "mcq", required: true },
  prompt: { type: String, required: true, trim: true },
  section: { type: String, default: "", trim: true },
  explanation: { type: String, default: "" },
  options: { type: [mcqOptionSchema], default: [] },
  correctOptionIndex: { type: Number, default: 0 },
  acceptableAnswers: { type: [String], default: [] },
});

const sectionQuotaSchema = new mongoose.Schema(
  { name: { type: String, required: true, trim: true }, count: { type: Number, required: true, min: 1 } },
  { _id: false },
);

const gradeBandSchema = new mongoose.Schema(
  { label: { type: String, required: true, trim: true }, minPercent: { type: Number, required: true, min: 0, max: 100 } },
  { _id: false },
);

const skillTestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    durationMinutes: { type: Number, required: true, min: 1 },

    questionPool: { type: [testQuestionSchema], default: [] },
    attemptSize: { type: Number, required: true, min: 1 },
    sections: { type: [sectionQuotaSchema], default: [] },
    maxAttempts: { type: Number, default: 3, min: 1 },
    passingPercentage: { type: Number, default: 80, min: 0, max: 100 },
    gradeBands: { type: [gradeBandSchema], default: () => DEFAULT_GRADE_BANDS.map((b) => ({ ...b })) },

    skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", default: null },
    badge: { type: mongoose.Schema.Types.ObjectId, ref: "Badge", default: null },
    isPublished: { type: Boolean, default: false },
    availableAt: { type: Date, default: null },

    skillGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: "SkillGroup" }],
  },
  { timestamps: true },
);

export default mongoose.model("SkillTest", skillTestSchema);
