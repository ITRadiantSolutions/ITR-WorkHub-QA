import mongoose from "mongoose";

// Additive, standalone join collection — deliberately NOT a change to
// Project.teamMembers, which Tracker/Timesheet already read directly for
// access control (see server/src/utils/projectAccess.js). This lets HRMS
// grant a per-project role without touching that existing behavior at all.
const projectRoleAssignmentSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["employee", "manager", "hr"], default: "employee" },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

projectRoleAssignmentSchema.index({ project: 1, user: 1 }, { unique: true });
projectRoleAssignmentSchema.index({ user: 1 });

export default mongoose.model("ProjectRoleAssignment", projectRoleAssignmentSchema);
