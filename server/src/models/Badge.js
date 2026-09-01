import mongoose from "mongoose";

const badgeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true, trim: true },
    category: { type: String, default: "General", trim: true },
    color: { type: String, default: "#7C3AED" },
    isAutoAwarded: { type: Boolean, default: true },
    criteria: { type: String, default: "pass_assessment", enum: ["pass_assessment", "complete_course", "manual"] },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

badgeSchema.index({ category: 1 });
badgeSchema.index({ isActive: 1 });

export default mongoose.model("Badge", badgeSchema);
