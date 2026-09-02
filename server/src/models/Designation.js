import mongoose from "mongoose";

const designationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },
    level: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export default mongoose.model("Designation", designationSchema);
