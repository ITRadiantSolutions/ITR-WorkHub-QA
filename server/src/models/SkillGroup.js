import mongoose from "mongoose";

// LMS-specific group model — deliberately separate from PMS's UsersGroup.js,
// whose findConflictingMembers logic enforces one-group-per-user. A skill
// group has no such constraint: an employee can belong to "Full Stack" and
// "Cloud" at the same time.
const skillGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true, default: "" },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model("SkillGroup", skillGroupSchema);
