import mongoose from "mongoose";

const skillCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, unique: true, lowercase: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

skillCategorySchema.pre("validate", function setNormalizedName() {
  this.name = this.name?.trim();
  this.normalizedName = this.name?.toLowerCase();
});

export default mongoose.model("SkillCategory", skillCategorySchema);
