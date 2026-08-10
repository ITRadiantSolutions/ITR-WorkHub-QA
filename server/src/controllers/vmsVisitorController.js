import Visitor, { VISIT_STATUS } from "../models/Visitor.js";
import Approval, { APPROVAL_STATUS } from "../models/Approval.js";
import User from "../models/User.js";
import { generateOtp, otpExpiresAt, isOtpValid } from "../utils/vmsOtp.js";
import { sendSms } from "../utils/sms.js";
import { sendMail } from "../utils/graphMailer.js";
import { uploadAttachment, createReadUrl } from "../config/blobStorage.js";
import { writeAuditLog } from "../utils/activityLog.js";

// Ported from the standalone VMS project's visitorController.js. Notable
// changes from the original while porting:
//  - otpCode/otpExpiresAt are `select: false` on the schema now, so they
//    never leak in a response by accident (the original had one endpoint,
//    createVisitor, that forgot to strip otpCode from its response).
//  - OTP generation moved to crypto.randomInt (was Math.random()).
//  - Visitor photos go through Azure Blob Storage (config/blobStorage.js),
//    same as PIP proof documents, instead of storing a base64 data URL
//    directly on the document.
//  - Audit trail writes into the shared ActivityLog collection instead of a
//    separate AuditLog collection.

const requireVmsStaff = (req, res) => {
  if (!["receptionist", "admin", "host"].includes(req.user.roles.vms)) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
};
const requireVmsHost = (req, res) => {
  if (req.user.roles.vms !== "host") {
    res.status(403).json({ error: "VMS Host access required" });
    return false;
  }
  return true;
};
const requireVmsReceptionOrAdmin = (req, res) => {
  if (!["receptionist", "admin"].includes(req.user.roles.vms)) {
    res.status(403).json({ error: "VMS Receptionist/Admin access required" });
    return false;
  }
  return true;
};
const requireVmsHostOrAdmin = (req, res) => {
  if (!["host", "admin"].includes(req.user.roles.vms)) {
    res.status(403).json({ error: "VMS Host/Admin access required" });
    return false;
  }
  return true;
};
const requireVmsAdmin = (req, res) => {
  if (req.user.roles.vms !== "admin") {
    res.status(403).json({ error: "VMS Admin access required" });
    return false;
  }
  return true;
};

const approvalRequestEmail = (hostName, visitorName) => `
  <div style="font-family: Arial, sans-serif; color:#1f2937;">
    <h2>Host Approval Request</h2>
    <p>Hi ${hostName},</p>
    <p><strong>${visitorName}</strong> is waiting for your approval to visit.</p>
    <p>Please review and respond in the Visitor Management System.</p>
  </div>`;

const createAudit = (req, visitorId, action, before, after) =>
  writeAuditLog({
    type: "database",
    event: action,
    action,
    actorId: req.user?._id || undefined,
    ip: req.ip,
    targetId: visitorId?.toString(),
    oldValue: before ?? undefined,
    newValue: after ?? undefined,
  });

// Resolves a stored photoUrl (a blob name) into a short-lived signed URL for
// the response. Leaves empty/already-external values untouched.
const withPhotoUrl = (visitor) => {
  if (!visitor) return visitor;
  // http(s) = already a usable URL; data: = a raw base64 photo (e.g. migrated
  // test data that was never uploaded to blob storage) — both render as-is in
  // an <img>. Anything else is treated as a blob name needing a signed URL.
  if (visitor.photoUrl && !visitor.photoUrl.startsWith("http") && !visitor.photoUrl.startsWith("data:")) {
    visitor.photoUrl = createReadUrl(visitor.photoUrl);
  }
  return visitor;
};
const withPhotoUrls = (visitors) => visitors.map(withPhotoUrl);

async function storeVisitorPhoto(photoDataUrl, visitorId) {
  const match = /^data:(image\/\w+);base64,(.+)$/.exec(photoDataUrl || "");
  if (!match) return "";
  const [, mimeType, base64] = match;
  const { blobName } = await uploadAttachment({
    buffer: Buffer.from(base64, "base64"),
    fileName: `visitor-${visitorId}.${mimeType.split("/")[1] || "png"}`,
    mimeType,
    scope: "visitors",
    parentId: visitorId.toString(),
  });
  return blobName;
}

async function autoCheckIn({ visitorId, req }) {
  const before = await Visitor.findById(visitorId).lean({ virtuals: true });
  if (!before) return null;
  if ([VISIT_STATUS.CHECKED_IN, VISIT_STATUS.CHECKED_OUT].includes(before.status)) return null;
  if (![VISIT_STATUS.APPROVED, VISIT_STATUS.FINAL_APPROVED].includes(before.status)) return null;

  const updated = await Visitor.findByIdAndUpdate(
    visitorId,
    { status: VISIT_STATUS.CHECKED_IN, checkInTime: new Date() },
    { new: true },
  ).lean({ virtuals: true });

  await createAudit(req, visitorId, "AUTO_CHECK_IN", before, updated);
  return updated;
}

export async function createVisitor(req, res) {
  try {
    const visitorData = req.body;
    if (!visitorData.fullName || !visitorData.mobileNumber) {
      return res.status(400).json({ error: "Missing required visitor fields" });
    }

    let host = null;
    const personToMeetValue = String(visitorData.personToMeetId || "").trim();
    if (/^[0-9a-fA-F]{24}$/.test(personToMeetValue)) {
      host = await User.findById(personToMeetValue).lean().catch(() => null);
    }
    if (!host && personToMeetValue) {
      host = await User.findOne({ email: personToMeetValue.toLowerCase() }).lean().catch(() => null);
    }

    const visitDateRaw = visitorData.visitDate;
    const visitDateParsed = visitDateRaw ? new Date(visitDateRaw) : null;
    if (visitDateParsed && Number.isNaN(visitDateParsed.getTime())) {
      return res.status(400).json({ error: "Invalid visit date" });
    }
    const visitDateText = visitDateParsed
      ? visitDateParsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : null;

    const otpCode = generateOtp();
    const expiresAt = otpExpiresAt(5, visitDateParsed);

    const visitor = await Visitor.create({
      fullName: visitorData.fullName,
      email: visitorData.email || "",
      mobileNumber: visitorData.mobileNumber,
      address: visitorData.address || "",
      purpose: visitorData.purpose || "",
      personToMeetId: host?._id || null,
      expectedDuration: visitorData.expectedDuration || "2 hours",
      visitorType: visitorData.visitorType === "Invited" ? "Invited" : "Guest",
      notes: visitorData.notes || "",
      visitDate: visitDateParsed ?? undefined,
      status: VISIT_STATUS.OTP_PENDING,
      otpCode,
      otpExpiresAt: expiresAt,
      createdById: req.user?._id || null,
    });

    if (visitorData.photoDataUrl) {
      visitor.photoUrl = await storeVisitorPhoto(visitorData.photoDataUrl, visitor._id);
      await visitor.save();
    }

    if (visitor.visitorType === "Invited" && visitor.personToMeetId) {
      await Approval.findOneAndUpdate(
        { visitorId: visitor._id, approverId: visitor.personToMeetId, role: "host" },
        { $set: { status: APPROVAL_STATUS.APPROVED, reason: "Host invited visitor" } },
        { upsert: true, new: true },
      );
    }

    const smsMessage = visitDateText
      ? `Dear ${visitor.fullName}, your visit to ITRadiant has been scheduled for ${visitDateText}. To complete your check-in, use OTP ${otpCode} at the Visitor Kiosk. Please keep this code confidential.`
      : `Dear ${visitor.fullName}, welcome to ITRadiant. Your Visitor Verification OTP is ${otpCode}. Please use this code at the Visitor Kiosk to complete your check-in.`;

    try {
      await sendSms(visitor.mobileNumber, smsMessage);
    } catch (smsError) {
      return res.status(500).json({ error: `Failed to send OTP SMS. ${smsError.message || ""}` });
    }

    await createAudit(req, visitor._id, "CREATE_VISITOR", null, visitor.toObject());

    const visitorWithHost = withPhotoUrl(
      await Visitor.findById(visitor._id).populate("personToMeetId", "name email").lean({ virtuals: true }),
    );
    return res.status(201).json({ visitor: visitorWithHost });
  } catch (error) {
    console.error("Error creating visitor:", error);
    return res.status(500).json({ error: `Failed to create visitor. ${error.message}` });
  }
}

export async function verifyOtp(req, res) {
  try {
    const { visitorId, code } = req.body;
    const visitor = await Visitor.findById(visitorId).select("+otpCode +otpExpiresAt").lean({ virtuals: true });
    if (!visitor) return res.status(404).json({ error: "Visitor not found" });

    const before = { status: visitor.status, otpAttempts: visitor.otpAttempts };
    const valid = isOtpValid(visitor, code);
    const updates = { otpAttempts: visitor.otpAttempts + 1 };

    if (valid && visitor.visitDate) {
      const sameDay = new Date().toDateString() === new Date(visitor.visitDate).toDateString();
      if (!sameDay) {
        await Visitor.findByIdAndUpdate(visitorId, updates);
        await createAudit(req, visitor._id, "VISIT_DATE_INVALID", before, updates);
        return res.status(400).json({ error: "Visit date not valid" });
      }
    }

    if (!valid) {
      await Visitor.findByIdAndUpdate(visitorId, updates);
      await createAudit(req, visitor._id, "OTP_FAILED", before, updates);
      return res.status(400).json({ error: "OTP invalid or expired" });
    }

    let updated;
    if (visitor.visitorType === "Invited") {
      updates.status = VISIT_STATUS.APPROVED;
      updated = await Visitor.findByIdAndUpdate(visitorId, updates, { new: true }).lean({ virtuals: true });
      await createAudit(req, visitor._id, "INVITED_VISITOR_VERIFIED", before, updated);
      await autoCheckIn({ visitorId, req });
    } else if (visitor.personToMeetId) {
      updates.status = VISIT_STATUS.HOST_PENDING;
      updated = await Visitor.findByIdAndUpdate(visitorId, updates, { new: true })
        .populate("personToMeetId", "name email")
        .lean({ virtuals: true });

      await Approval.findOneAndUpdate(
        { visitorId, role: "host" },
        { $set: { approverId: visitor.personToMeetId, status: APPROVAL_STATUS.PENDING, reason: "" } },
        { upsert: true, new: true },
      );
      await createAudit(req, visitor._id, "OTP_VERIFIED", before, updated);

      const host = await User.findById(visitor.personToMeetId).lean();
      if (host?.email) {
        await sendMail(host.email, "Visitor Approval Request", approvalRequestEmail(host.name, visitor.fullName)).catch(() => null);
      }
    } else {
      updates.status = VISIT_STATUS.OTP_VERIFIED;
      updated = await Visitor.findByIdAndUpdate(visitorId, updates, { new: true }).lean({ virtuals: true });
      await createAudit(req, visitor._id, "OTP_VERIFIED_NO_HOST", before, updated);
    }

    return res.json({ success: true, visitor: withPhotoUrl(updated) });
  } catch (error) {
    console.error("verifyOtp:", error);
    return res.status(500).json({ error: "Failed to verify OTP" });
  }
}

// Despite the name (kept for route-path/frontend-caller continuity), this
// works for any visitor still in OTP_PENDING — Guest and Invited alike need
// resend if the first SMS is delayed or lost. Originally Invited-only; that
// restriction had no real justification and just made the kiosk's own
// "Resend OTP" button 400 for every walk-in visitor.
export async function resendInvitedOtpByVisitorId(req, res) {
  try {
    const { visitorId } = req.body;
    if (!visitorId) return res.status(400).json({ error: "visitorId is required" });

    const visitor = await Visitor.findById(visitorId).lean({ virtuals: true });
    if (!visitor) return res.status(404).json({ error: "Visitor not found" });
    if (visitor.status !== VISIT_STATUS.OTP_PENDING) {
      return res.status(400).json({ error: "OTP resend not available for this status" });
    }

    const otpCode = generateOtp();
    const otpExpiresAtValue = otpExpiresAt(5, visitor.visitDate);
    await Visitor.findByIdAndUpdate(visitor._id, {
      otpCode,
      otpExpiresAt: otpExpiresAtValue,
      otpAttempts: 0,
      status: VISIT_STATUS.OTP_PENDING,
    });

    const visitDateText = visitor.visitDate
      ? new Date(visitor.visitDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : null;
    const smsMessage = visitDateText
      ? `Dear ${visitor.fullName}, your OTP has been resent for your visit scheduled on ${visitDateText}. Your new OTP is ${otpCode}.`
      : `Dear ${visitor.fullName}, your OTP has been resent. Your new OTP is ${otpCode}.`;

    await sendSms(visitor.mobileNumber, smsMessage);
    await createAudit(req, visitor._id, "OTP_RESENT", { otpAttempts: visitor.otpAttempts }, { otpAttempts: 0 });

    return res.json({ success: true });
  } catch (error) {
    console.error("resendInvitedOtpByVisitorId:", error);
    return res.status(500).json({ error: "Failed to resend OTP" });
  }
}

export async function verifyInvitedOtpByCode(req, res) {
  try {
    const { code } = req.body;
    if (!code || String(code).trim().length !== 6) {
      return res.status(400).json({ error: "Invalid code" });
    }
    const normalizedCode = String(code).trim();

    // select:false only hides a field from the *returned* document — it can
    // still be filtered on directly, so this matches the specific visitor
    // this code belongs to rather than just the most recently created one.
    const matched = await Visitor.findOne({
      otpCode: normalizedCode,
      visitorType: "Invited",
      status: VISIT_STATUS.OTP_PENDING,
      otpExpiresAt: { $gte: new Date() },
      otpAttempts: { $lt: 3 },
    })
      .select("+otpCode +otpExpiresAt")
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    if (!matched) {
      return res.status(400).json({ error: "OTP invalid or expired" });
    }

    const before = { status: matched.status, otpAttempts: matched.otpAttempts };

    await Visitor.findByIdAndUpdate(matched._id, { status: VISIT_STATUS.APPROVED, otpCode: "", otpAttempts: 0 });
    await autoCheckIn({ visitorId: matched._id, req });
    await Approval.updateMany(
      { visitorId: matched._id, role: "host" },
      { $set: { status: APPROVAL_STATUS.APPROVED, reason: "Invited visitor verified OTP" } },
    );

    const updated = await Visitor.findById(matched._id)
      .populate("personToMeetId", "name email")
      .populate("createdById", "name email")
      .lean({ virtuals: true });

    await createAudit(req, matched._id, "INVITED_VISITOR_APPROVED", before, updated);
    return res.json({ success: true, visitor: withPhotoUrl(updated) });
  } catch (error) {
    console.error("verifyInvitedOtpByCode:", error);
    return res.status(500).json({ error: "Failed to verify OTP" });
  }
}

export async function listVisitors(req, res) {
  if (!requireVmsStaff(req, res)) return;
  const { status, search } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (search) {
    // Escape regex metacharacters — this was user input going straight into
    // $regex unescaped, so e.g. a stray `(` would 500 the whole request.
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { fullName: { $regex: escaped, $options: "i" } },
      { mobileNumber: { $regex: escaped, $options: "i" } },
      { purpose: { $regex: escaped, $options: "i" } },
    ];
  }
  const visitors = await Visitor.find(filter).populate("personToMeet").sort({ createdAt: -1 }).lean({ virtuals: true });
  return res.json({ visitors: withPhotoUrls(visitors) });
}

async function listByHostApproval(req, res, status) {
  if (!requireVmsHost(req, res)) return;
  const approvals = await Approval.find({ approverId: req.user._id, role: "host", status }).sort({ createdAt: -1 }).lean();
  const visitorIds = approvals.map((a) => a.visitorId).filter(Boolean);
  const visitors = visitorIds.length
    ? await Visitor.find({ _id: { $in: visitorIds } }).populate("personToMeet").sort({ createdAt: -1 }).lean({ virtuals: true })
    : [];
  return res.json({ visitors: withPhotoUrls(visitors) });
}

export const getHostPendingVisitors = (req, res) => listByHostApproval(req, res, APPROVAL_STATUS.PENDING);
export const getHostApprovedVisitors = (req, res) => listByHostApproval(req, res, APPROVAL_STATUS.APPROVED);
export const getHostRejectedVisitors = (req, res) => listByHostApproval(req, res, APPROVAL_STATUS.REJECTED);

export async function listInvitedVisitorsForAdmin(req, res) {
  if (!requireVmsAdmin(req, res)) return;
  const visitors = await Visitor.find({ visitorType: "Invited" })
    .populate("personToMeet")
    .populate("createdById", "name email")
    .sort({ createdAt: -1 })
    .lean({ virtuals: true });
  return res.json({ visitors: withPhotoUrls(visitors) });
}

export async function listInvitedVisitorsForHost(req, res) {
  if (!requireVmsHost(req, res)) return;
  try {
    const visitors = await Visitor.find({
      visitorType: "Invited",
      $or: [{ createdById: req.user._id }, { personToMeetId: req.user._id }],
    })
      .populate("personToMeet", "name email")
      .populate("createdById", "name email")
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });
    return res.json({ success: true, visitors: withPhotoUrls(visitors) });
  } catch (error) {
    console.error("listInvitedVisitorsForHost:", error);
    return res.status(500).json({ error: "Failed to load invited visitors" });
  }
}

export async function approvalAction(req, res) {
  if (!requireVmsReceptionOrAdmin(req, res)) return;
  const { visitorId, action, reason } = req.body;
  const visitor = await Visitor.findById(visitorId).lean({ virtuals: true });
  if (!visitor) return res.status(404).json({ error: "Visitor not found" });

  let statusUpdate;
  let approvalRole = "receptionist";
  if (action === "approve") {
    statusUpdate = visitor.status === VISIT_STATUS.ESCALATED ? VISIT_STATUS.SECURITY_APPROVED : VISIT_STATUS.RECEPTION_APPROVED;
  } else if (action === "escalate") {
    statusUpdate = VISIT_STATUS.ESCALATED;
    approvalRole = "admin";
  } else {
    return res.status(400).json({ error: "Invalid action" });
  }

  const updated = await Visitor.findByIdAndUpdate(visitorId, { status: statusUpdate, escalatedReason: reason }, { new: true }).lean({ virtuals: true });
  // "approve" is the approver's own final decision on this record (APPROVED).
  // "escalate" hands the decision to security/admin, whose Approval record is
  // still awaiting their action (PENDING).
  const approvalStatus = action === "approve" ? APPROVAL_STATUS.APPROVED : APPROVAL_STATUS.PENDING;
  await Approval.create({ visitorId, approverId: req.user._id, role: approvalRole, status: approvalStatus, reason });
  await createAudit(req, visitor._id, "VISITOR_APPROVAL", visitor, updated);

  if (action === "approve" && visitor.personToMeetId) {
    const host = await User.findById(visitor.personToMeetId).lean();
    if (host?.email) {
      await sendMail(host.email, "Host approval requested", approvalRequestEmail(host.name, visitor.fullName)).catch(() => null);
    }
  }

  return res.json({ visitor: withPhotoUrl(updated) });
}

export async function hostApprove(req, res) {
  if (!requireVmsHostOrAdmin(req, res)) return;
  const { visitorId, approved, reason } = req.body;
  const visitor = await Visitor.findById(visitorId).lean({ virtuals: true });
  if (!visitor) return res.status(404).json({ error: "Visitor not found" });

  if (req.user.roles.vms === "host" && visitor.personToMeetId?.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: "Not authorized to approve this visitor" });
  }

  const finalVisitStatus = approved ? VISIT_STATUS.FINAL_APPROVED : VISIT_STATUS.REJECTED;
  const finalApprovalStatus = approved ? APPROVAL_STATUS.APPROVED : APPROVAL_STATUS.REJECTED;

  const updated = await Visitor.findByIdAndUpdate(
    visitorId,
    { status: finalVisitStatus, approvedBy: req.user._id },
    { new: true },
  ).lean({ virtuals: true });

  if (approved === true) await autoCheckIn({ visitorId, req });

  // Host dashboards key off Approval.status — close any pending/more-info
  // records for this visitor+approver so a visitor never shows in two tabs.
  await Approval.updateMany(
    { visitorId, approverId: req.user._id, role: "host", status: { $in: [APPROVAL_STATUS.PENDING, APPROVAL_STATUS.MORE_INFO] } },
    { $set: { status: finalApprovalStatus, reason } },
  );
  const existingFinal = await Approval.findOne({ visitorId, approverId: req.user._id, role: "host", status: finalApprovalStatus }).lean();
  if (!existingFinal) {
    await Approval.create({ visitorId, approverId: req.user._id, role: "host", status: finalApprovalStatus, reason });
  } else {
    await Approval.updateOne({ _id: existingFinal._id }, { $set: { reason } });
  }

  await createAudit(req, visitor._id, "HOST_APPROVAL", visitor, updated);
  return res.json({ visitor: withPhotoUrl(updated) });
}

export async function getVisitor(req, res) {
  if (!requireVmsStaff(req, res)) return;
  const { visitorId } = req.params;
  if (!visitorId || !/^[0-9a-fA-F]{24}$/.test(visitorId)) {
    return res.status(400).json({ error: "Invalid visitor id" });
  }
  const visitor = await Visitor.findById(visitorId).populate("personToMeet").populate("createdById", "name email").lean({ virtuals: true });
  if (!visitor) return res.status(404).json({ error: "Visitor not found" });
  return res.json({ visitor: withPhotoUrl(visitor) });
}

export async function checkIn(req, res) {
  if (!requireVmsReceptionOrAdmin(req, res)) return;
  const { visitorId } = req.body;
  const visitor = await Visitor.findById(visitorId).lean({ virtuals: true });
  if (!visitor) return res.status(404).json({ error: "Visitor not found" });
  if (visitor.status !== VISIT_STATUS.FINAL_APPROVED) {
    return res.status(400).json({ error: "Visitor not ready for check-in" });
  }
  const updated = await Visitor.findByIdAndUpdate(visitorId, { status: VISIT_STATUS.CHECKED_IN, checkInTime: new Date() }, { new: true }).lean({ virtuals: true });
  await createAudit(req, visitor._id, "CHECK_IN", visitor, updated);
  return res.json({ visitor: withPhotoUrl(updated) });
}

export async function checkOut(req, res) {
  if (!requireVmsReceptionOrAdmin(req, res)) return;
  const { visitorId } = req.body;
  const visitor = await Visitor.findById(visitorId).lean({ virtuals: true });
  if (!visitor) return res.status(404).json({ error: "Visitor not found" });
  if (visitor.status !== VISIT_STATUS.CHECKED_IN) {
    return res.status(400).json({ error: "Visitor is not checked in" });
  }
  const updated = await Visitor.findByIdAndUpdate(visitorId, { status: VISIT_STATUS.CHECKED_OUT, checkOutTime: new Date() }, { new: true }).lean({ virtuals: true });
  await createAudit(req, visitor._id, "CHECK_OUT", visitor, updated);
  return res.json({ visitor: withPhotoUrl(updated) });
}
