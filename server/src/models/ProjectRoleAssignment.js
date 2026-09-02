import mongoose from "mongoose";

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
