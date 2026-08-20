import mongoose from "mongoose";

const DEFAULT_ITEMS = [
  "Offer accepted",
  "Documents collected",
  "Assets allocated",
  "System access provisioned",
  "Induction completed",
];

const onboardingSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: [
      {
        label: { type: String, required: true, trim: true },
        done: { type: Boolean, default: false },
        completedAt: { type: Date, default: null },
        completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      },
    ],
    status: { type: String, enum: ["in_progress", "completed"], default: "in_progress" },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

onboardingSchema.statics.DEFAULT_ITEMS = DEFAULT_ITEMS;

export default mongoose.model("Onboarding", onboardingSchema);
