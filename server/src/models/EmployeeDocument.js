import mongoose from "mongoose";

export const DOCUMENT_CATEGORIES = [
  "offer_letter",
  "id_proof",
  "education_certificate",
  "experience_letter",
  "policy_acknowledgement",
  "other",
];

const employeeDocumentSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, enum: DOCUMENT_CATEGORIES, default: "other" },
    blobName: { type: String, required: true },
    fileName: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

export default mongoose.model("EmployeeDocument", employeeDocumentSchema);
