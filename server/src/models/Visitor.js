import mongoose from "mongoose";

// Ported from the standalone VMS project's Visitor model. Status values
// lowercased to match this codebase's enum convention (see Submission.js,
// KraAssignment.js) — the original used SCREAMING_CASE throughout.
export const VISIT_STATUS = {
  DRAFT: "draft",
  OTP_PENDING: "otp_pending",
  OTP_VERIFIED: "otp_verified",
  RECEPTION_APPROVED: "reception_approved",
  ESCALATED: "escalated",
  SECURITY_APPROVED: "security_approved",
  HOST_PENDING: "host_pending",
  APPROVED: "approved",
  FINAL_APPROVED: "final_approved",
  CHECKED_IN: "checked_in",
  CHECKED_OUT: "checked_out",
  REJECTED: "rejected",
  BLACKLISTED: "blacklisted",
};

const visitorSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    mobileNumber: { type: String, required: true, trim: true },
    address: { type: String, trim: true, default: "" },
    purpose: { type: String, trim: true, default: "" },

    personToMeetId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    expectedDuration: { type: String, default: "2 hours" },
    // "Guest" (walk-in) or "Invited" (pre-scheduled by a host).
    visitorType: { type: String, enum: ["Guest", "Invited"], default: "Guest" },

    notes: { type: String, trim: true, default: "" },
    photoUrl: { type: String, default: "" },
    status: { type: String, enum: Object.values(VISIT_STATUS), default: VISIT_STATUS.DRAFT, index: true },

    otpCode: { type: String, default: "", select: false },
    otpExpiresAt: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0 },

    visitDate: { type: Date, default: null },
    escalatedReason: { type: String, trim: true, default: "" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    checkInTime: { type: Date, default: null },
    checkOutTime: { type: Date, default: null },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

visitorSchema.virtual("personToMeet", {
  ref: "User",
  localField: "personToMeetId",
  foreignField: "_id",
  justOne: true,
});

visitorSchema.set("toObject", { virtuals: true });
visitorSchema.set("toJSON", { virtuals: true });

visitorSchema.index({ status: 1, createdAt: -1 });
visitorSchema.index({ personToMeetId: 1, status: 1 });

export default mongoose.models.Visitor || mongoose.model("Visitor", visitorSchema);
