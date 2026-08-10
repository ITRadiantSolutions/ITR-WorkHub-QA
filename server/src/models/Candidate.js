import mongoose from "mongoose";

// The person being referred, kept separate from Referral so the same
// candidate can be referred for multiple jobs without duplicating their info.
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
