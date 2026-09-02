import mongoose from "mongoose";

const candidateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    phone: { type: String, trim: true, default: "" },
    experienceYears: { type: Number, default: null },
    currentCompany: { type: String, trim: true, default: "" },
    skills: [{ type: String, trim: true }],
    resumeBlobName: { type: String, default: "" },
    resumeFileName: { type: String, default: "" },
    source: { type: String, trim: true, default: "referral" },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

export default mongoose.model("Candidate", candidateSchema);
