import mongoose from "mongoose";

const gradeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    level: { type: Number, default: 0 },
    minSalary: { type: Number, default: null },
    maxSalary: { type: Number, default: null },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export default mongoose.model("Grade", gradeSchema);
