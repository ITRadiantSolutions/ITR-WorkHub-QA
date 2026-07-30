import mongoose from "mongoose";

const userIssueSchema = new mongoose.Schema(
  {
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, required: true, trim: true },
    status: { type: String, enum: ["OPEN", "RESOLVED"], default: "OPEN" },
  },
  // Explicit name: Mongoose's default pluralization ("userissues") doesn't
  // match the "user_issues" collection the data migration wrote to.
  { timestamps: true, collection: "user_issues" },
);

export default mongoose.model("UserIssue", userIssueSchema);
