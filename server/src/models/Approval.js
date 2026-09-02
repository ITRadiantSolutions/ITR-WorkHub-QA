import mongoose from "mongoose";

export const APPROVAL_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  MORE_INFO: "more_info",
};

const approvalSchema = new mongoose.Schema(
  {
    visitorId: { type: mongoose.Schema.Types.ObjectId, ref: "Visitor", required: true, index: true },
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    role: { type: String, enum: ["admin", "receptionist", "host"], required: true },
    status: { type: String, enum: Object.values(APPROVAL_STATUS), default: APPROVAL_STATUS.PENDING },
    reason: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

approvalSchema.index({ visitorId: 1, role: 1 });
approvalSchema.index({ approverId: 1, role: 1, status: 1 });

export default mongoose.models.Approval || mongoose.model("Approval", approvalSchema);
