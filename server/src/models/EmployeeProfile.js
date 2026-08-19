import mongoose from "mongoose";

// Ported from the standalone LMS project's employeeProfileModel.js. Shared
// between LMS (skill/badge tracking, assignment eligibility) and the
// not-yet-ported HRMS/recruitment module (resume + experience for referrals).
const employeeProfileSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },

    // Blob name — resolved to a signed read URL on the way out (see Course.js).
    resume: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },

    experiences: [
      {
        company: { type: String, trim: true, default: "" },
        role: { type: String, trim: true, default: "" },
        start: { type: String, trim: true, default: "" },
        end: { type: String, trim: true, default: "" },
        description: { type: String, trim: true, default: "" },
      },
    ],

    skills: [
      {
        skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", required: true },
        level: { type: String, enum: ["Beginner", "Intermediate", "Advanced", "Expert"], default: "Beginner" },
        status: { type: String, enum: ["Learning", "Completed", "Verified"], default: "Learning" },
        verifiedAt: Date,
        assignedAt: { type: Date, default: Date.now },
      },
    ],

    badges: [{ type: mongoose.Schema.Types.ObjectId, ref: "Badge" }],

    badgeAwards: [
      {
        badge: { type: mongoose.Schema.Types.ObjectId, ref: "Badge", required: true },
        // Exactly one of course/test is set, depending on how the badge was
        // earned. required:true -> default:null is backward compatible —
        // Mongoose only validates on write, existing rows already satisfy it.
        course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null },
        test: { type: mongoose.Schema.Types.ObjectId, ref: "SkillTest", default: null },
        assessmentType: { type: String, enum: ["quiz", "assignment", "skill_test"], required: true },
        earnedAt: { type: Date, default: Date.now },
      },
    ],

    completedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
    totalCoursesCompleted: { type: Number, default: 0 },
    totalSkills: { type: Number, default: 0 },
    learningProgress: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.model("EmployeeProfile", employeeProfileSchema);
