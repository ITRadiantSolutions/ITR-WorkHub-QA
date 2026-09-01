import mongoose from "mongoose";

const activityHistorySchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: ["material_completed", "quiz_submitted", "assignment_submitted"],
      required: true,
    },
    detail: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const attemptHistorySchema = new mongoose.Schema(
  {
    attemptNo: { type: Number, required: true },
    assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseAssessment", default: null },
    submittedAt: { type: Date, default: Date.now },
    questionIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    score: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    correctAnswers: { type: Number, default: 0 },
    wrongAnswers: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 1 },
    passingPercentage: { type: Number, default: 80 },
    totalQuestions: { type: Number, default: 0 },
    badgeAwarded: { type: Boolean, default: false },
    badgeId: { type: mongoose.Schema.Types.ObjectId, ref: "Badge", default: null },
    skillAwarded: { type: Boolean, default: false },
    skillId: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", default: null },
  },
  { _id: false },
);

const courseProgressSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    completedMaterials: { type: [String], default: [] },
    completedPdfs: { type: [String], default: [] },

    activityHistory: { type: [activityHistorySchema], default: [] },

    quizStatus: { type: String, enum: ["not_started", "passed", "failed"], default: "not_started" },
    quizScore: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    wrongAnswers: { type: Number, default: 0 },
    quizAttempt: { type: Number, default: 0 },
    quizAssessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseAssessment", default: null },
    submittedAnswers: { type: mongoose.Schema.Types.Mixed, default: [] },

    finalAssignmentStatus: {
      type: String,
      enum: ["not_submitted", "pending", "submitted"],
      default: "not_submitted",
    },
    finalAssignmentScore: { type: Number, default: 0 },
    finalAssignmentCorrectAnswers: { type: Number, default: 0 },
    finalAssignmentWrongAnswers: { type: Number, default: 0 },
    finalAssignmentAttempt: { type: Number, default: 0 },
    finalAssignmentAssessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseAssessment", default: null },
    finalAssignmentSubmittedAnswers: { type: mongoose.Schema.Types.Mixed, default: [] },

    quizBadgeAwarded: { type: Boolean, default: false },
    quizSkillAwarded: { type: Boolean, default: false },
    finalAssignmentBadgeAwarded: { type: Boolean, default: false },
    finalAssignmentSkillAwarded: { type: Boolean, default: false },

    quizLastSubmission: {
      assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseAssessment", default: null },
      attemptNo: { type: Number, default: 0 },
    },
    finalAssignmentLastSubmission: {
      assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseAssessment", default: null },
      attemptNo: { type: Number, default: 0 },
    },

    quizAttemptsHistory: { type: [attemptHistorySchema], default: [] },
    finalAssignmentAttemptsHistory: { type: [attemptHistorySchema], default: [] },

    quizCurrentAttempt: {
      attemptNo: { type: Number, default: 0 },
      questionIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
      startedAt: { type: Date, default: null },
    },
    finalAssignmentCurrentAttempt: {
      attemptNo: { type: Number, default: 0 },
      questionIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
      startedAt: { type: Date, default: null },
    },

    quizRetakeDueBy: { type: Date, default: null },
    finalAssignmentRetakeDueBy: { type: Date, default: null },
    quizRetakeReminderSentAt: { type: Date, default: null },
    finalAssignmentRetakeReminderSentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

courseProgressSchema.index({ course: 1, employee: 1 }, { unique: true });

export default mongoose.model("CourseProgress", courseProgressSchema);
