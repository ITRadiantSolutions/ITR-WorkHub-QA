import mongoose from "mongoose";

export const HR_REQUEST_TYPES = [
  "salary_certificate",
  "experience_letter",
  "document_request",
  "profile_change",
  "bank_change",
  "query",
];

const hrRequestSchema = new mongoose.Schema(
  {
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: HR_REQUEST_TYPES, required: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },

    status: { type: String, enum: ["open", "in_progress", "resolved"], default: "open" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolutionNote: { type: String, trim: true, default: "" },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.model("HrRequest", hrRequestSchema);
