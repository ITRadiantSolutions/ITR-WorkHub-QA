import mongoose from "mongoose";

const sectionBreakdownSchema = new mongoose.Schema(
  { name: { type: String, default: "" }, correct: { type: Number, default: 0 }, total: { type: Number, default: 0 } },
  { _id: false },
);

const answerResultSchema = new mongoose.Schema(
  {
    question: { type: mongoose.Schema.Types.ObjectId },
    given: { type: mongoose.Schema.Types.Mixed, default: null },
    correct: { type: Boolean, default: false },
  },
  { _id: false },
);

const attemptHistorySchema = new mongoose.Schema(
  {
    attemptNo: { type: Number, required: true },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: null },
    questionIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    score: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    grade: { type: String, default: "" },
    correctCount: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    sectionBreakdown: { type: [sectionBreakdownSchema], default: [] },
    answers: { type: [answerResultSchema], default: [] },
    badgeAwarded: { type: Boolean, default: false },
    badgeId: { type: mongoose.Schema.Types.ObjectId, ref: "Badge", default: null },
    skillAwarded: { type: Boolean, default: false },
    skillId: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", default: null },
  },
  { _id: false },
);

const skillTestProgressSchema = new mongoose.Schema(
  {
    test: { type: mongoose.Schema.Types.ObjectId, ref: "SkillTest", required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    status: { type: String, enum: ["not_started", "in_progress", "passed", "failed"], default: "not_started" },
    attemptCount: { type: Number, default: 0 },

    currentAttempt: {
      attemptNo: { type: Number, default: 0 },
      questionIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
      startedAt: { type: Date, default: null },
    },

    lastSubmission: {
      attemptNo: { type: Number, default: 0 },
      answersHash: { type: String, default: "" },
    },

    badgeAwarded: { type: Boolean, default: false },
    skillAwarded: { type: Boolean, default: false },

    attemptsHistory: { type: [attemptHistorySchema], default: [] },
  },
  { timestamps: true },
);

skillTestProgressSchema.index({ test: 1, employee: 1 }, { unique: true });

export default mongoose.model("SkillTestProgress", skillTestProgressSchema);
