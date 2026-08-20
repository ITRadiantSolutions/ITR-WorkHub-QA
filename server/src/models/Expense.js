import mongoose from "mongoose";

export const EXPENSE_CATEGORIES = ["travel", "food", "accommodation", "office_supplies", "internet", "other"];

const expenseSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    expenseDate: { type: Date, required: true },
    description: { type: String, trim: true, default: "" },
    billBlobName: { type: String, default: "" },
    billFileName: { type: String, default: "" },

    status: { type: String, enum: ["submitted", "approved", "rejected", "reimbursed"], default: "submitted" },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
    decisionComment: { type: String, trim: true, default: "" },
    reimbursedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.model("Expense", expenseSchema);
