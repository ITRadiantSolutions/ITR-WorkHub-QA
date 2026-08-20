import mongoose from "mongoose";

const offboardingSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    resignationDate: { type: Date, required: true },
    lastWorkingDate: { type: Date, required: true },
    reason: { type: String, trim: true, default: "" },
    // "cleared" only once the exit interview is recorded and final settlement
    // is processed — see processFinalSettlement's guard in the controller.
    status: { type: String, enum: ["notice_period", "cleared"], default: "notice_period" },

    exitInterview: {
      conducted: { type: Boolean, default: false },
      conductedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      conductedAt: { type: Date, default: null },
      notes: { type: String, trim: true, default: "" },
    },
    finalSettlement: {
      processed: { type: Boolean, default: false },
      processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      processedAt: { type: Date, default: null },
      notes: { type: String, trim: true, default: "" },
    },

    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export default mongoose.model("Offboarding", offboardingSchema);
