import mongoose from "mongoose";

const userIssueSchema = new mongoose.Schema(
  {
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, required: true, trim: true },
    status: { type: String, enum: ["OPEN", "RESOLVED"], default: "OPEN" },
  },
  { timestamps: true, collection: "user_issues" },
);

export default mongoose.model("UserIssue", userIssueSchema);
