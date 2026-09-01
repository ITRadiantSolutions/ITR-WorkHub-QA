import mongoose from "mongoose";


const materialReportSchema = new mongoose.Schema(
  {
    lectureId: { type: mongoose.Schema.Types.ObjectId, ref: "Lecture" },
    materialIndex: Number,
    materialType: { type: String, enum: ["pdf", "video", "videoLink"] },
    title: String,
    completed: { type: Boolean, default: false },
    completedAt: Date,
    timeSpentMinutes: { type: Number, default: 0 },
    lastOpenedAt: Date,
  },
  { _id: false },
);

const attemptHistorySchema = new mongoose.Schema(
  {
    attemptNo: Number,
    assessmentId: mongoose.Schema.Types.ObjectId,
    submittedAt: Date,
    completedAt: Date,
    score: Number,
    passed: Boolean,
    status: String,
    correctAnswers: Number,
    wrongAnswers: Number,
    maxAttempts: Number,
    passingPercentage: Number,
    totalQuestions: Number,
    badgeAwarded: Boolean,
    badgeId: mongoose.Schema.Types.ObjectId,
    skillAwarded: Boolean,
    skillId: mongoose.Schema.Types.ObjectId,
    remarks: String,
    feedback: String,
  },
  { _id: false },
);

const quizReportSchema = new mongoose.Schema(
  {
    assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseAssessment" },
    available: Boolean,
    status: { type: String, enum: ["not_started", "passed", "failed"], default: "not_started" },
    attempts: Number,
    maxAttempts: Number,
    score: Number,
    passingPercentage: Number,
    totalQuestions: Number,
    correctAnswers: Number,
    wrongAnswers: Number,
    completedAt: Date,
    attemptsHistory: { type: [attemptHistorySchema], default: [] },
  },
  { _id: false },
);

const assignmentReportSchema = new mongoose.Schema(
  {
    assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseAssessment" },
    available: Boolean,
    status: {
      type: String,
      enum: ["not_submitted", "pending", "submitted", "approved", "rejected"],
      default: "not_submitted",
    },
    attempts: Number,
    maxAttempts: Number,
    score: Number,
    totalQuestions: Number,
    correctAnswers: Number,
    wrongAnswers: Number,
    passingPercentage: Number,
    submittedAt: Date,
    evaluatedAt: Date,
    evaluatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    attemptsHistory: { type: [attemptHistorySchema], default: [] },
  },
  { _id: false },
);

const courseReportSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
    title: String,
    category: String,
    level: String,
    thumbnail: String,
    instructor: String,
    assignedDate: Date,
    enrolledDate: Date,
    startedDate: Date,
    completedDate: Date,
    lastAccessed: Date,
    status: {
      type: String,
      enum: ["assigned", "not_started", "learning", "completed", "passed", "failed"],
      default: "assigned",
    },
    progress: { type: Number, default: 0 },
    learningHours: { type: Number, default: 0 },
    totalLectures: Number,
    completedLectures: Number,
    totalMaterials: Number,
    completedMaterials: Number,
    pendingMaterials: Number,
    materials: { type: [materialReportSchema], default: [] },
    quiz: quizReportSchema,
    assignment: assignmentReportSchema,
    earnedSkills: [
      {
        skillId: { type: mongoose.Schema.Types.ObjectId, ref: "Skill" },
        name: String,
        level: String,
        earnedAt: Date,
      },
    ],
    earnedBadges: [
      {
        badgeId: { type: mongoose.Schema.Types.ObjectId, ref: "Badge" },
        title: String,
        earnedAt: Date,
      },
    ],
  },
  { _id: false },
);

const lmsLearningReportSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true, index: true },
    employeeName: String,
    employeeEmail: String,
    employeePhoto: String,
    department: String,
    designation: String,
    role: String,
    manager: String,

    generatedAt: { type: Date, default: Date.now },
    lastActivity: Date,

    summary: {
      enrolledCourses: Number,
      completedCourses: Number,
      inProgressCourses: Number,
      notStartedCourses: Number,
      failedCourses: Number,
      averageProgress: Number,
      totalLearningHours: Number,
      totalMaterials: Number,
      completedMaterials: Number,
      pendingMaterials: Number,
      totalSkills: Number,
      verifiedSkills: Number,
      earnedBadges: Number,
      certificates: Number,
      quizPassed: Number,
      assignmentsSubmitted: Number,
    },

    skills: [
      {
        skillId: { type: mongoose.Schema.Types.ObjectId, ref: "Skill" },
        name: String,
        category: String,
        level: String,
        verified: Boolean,
        earnedAt: Date,
      },
    ],

    badges: [
      {
        badgeId: { type: mongoose.Schema.Types.ObjectId, ref: "Badge" },
        title: String,
        icon: String,
        earnedAt: Date,
      },
    ],

    courses: { type: [courseReportSchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model("LmsLearningReport", lmsLearningReportSchema);
