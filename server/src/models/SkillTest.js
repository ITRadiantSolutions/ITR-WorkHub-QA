import mongoose from "mongoose";

const mcqOptionSchema = new mongoose.Schema({ text: { type: String, required: true } }, { _id: false });

// Descending minPercent order is what resolveGrade() expects; the controller
// re-sorts on write so a mis-ordered payload can't produce a wrong grade.
export const DEFAULT_GRADE_BANDS = [
  { label: "Expert", minPercent: 90 },
  { label: "Proficient", minPercent: 75 },
  { label: "Intermediate", minPercent: 50 },
  { label: "Beginner", minPercent: 25 },
  { label: "Needs Revision", minPercent: 0 },
];

// Unlike CourseAssessment's questionSchema, this keeps its own _id — the
// server needs to reference specific pool questions when sampling an
// attempt's subset and grading against exactly those ids.
const testQuestionSchema = new mongoose.Schema({
  type: { type: String, enum: ["mcq", "fill_blank"], default: "mcq", required: true },
  prompt: { type: String, required: true, trim: true },
  // Optional bucket a question belongs to (e.g. "Node.js" / "React.js"). When a
  // test defines `sections`, sampling draws a fixed quota from each section
  // instead of a flat random subset of the whole pool.
  section: { type: String, default: "", trim: true },
  // Shown after grading for learning-oriented tests. Captured on import; no
  // review UI yet.
  explanation: { type: String, default: "" },
  // mcq only
  options: { type: [mcqOptionSchema], default: [] },
  correctOptionIndex: { type: Number, default: 0 },
  // fill_blank only — case-insensitive/trimmed match against any of these
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
    // How many questions are sampled from questionPool per attempt. With
    // `sections` set this is derived (sum of section counts) and kept in sync
    // by the controller; otherwise it's a flat count validated
    // <= questionPool.length.
    attemptSize: { type: Number, required: true, min: 1 },
    // Per-section draw quotas. Empty => flat `attemptSize` sampling (unchanged
    // legacy behavior). Non-empty => each attempt gets exactly `count`
    // questions from each named section.
    sections: { type: [sectionQuotaSchema], default: [] },
    maxAttempts: { type: Number, default: 3, min: 1 },
    passingPercentage: { type: Number, default: 80, min: 0, max: 100 },
    // Score% -> label bands, descending by minPercent. Independent of
    // passingPercentage (which still gates badge/skill awards).
    gradeBands: { type: [gradeBandSchema], default: () => DEFAULT_GRADE_BANDS.map((b) => ({ ...b })) },

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
