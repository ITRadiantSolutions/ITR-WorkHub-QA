import mongoose from "mongoose";

const employeeProfileSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
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
