import { Router } from "express";
import rateLimit from "express-rate-limit";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import {
  createVisitor,
  verifyOtp,
  verifyInvitedOtpByCode,
  resendInvitedOtpByVisitorId,
  listVisitors,
  getHostPendingVisitors,
  getHostApprovedVisitors,
  getHostRejectedVisitors,
  listInvitedVisitorsForAdmin,
  listInvitedVisitorsForHost,
  approvalAction,
  hostApprove,
  getVisitor,
  checkIn,
  checkOut,
} from "../../controllers/vmsVisitorController.js";
import { validateCreateVisitor, validateVerifyOtp, validateResendOtp, validateVerifyInvitedOtpByCode } from "../../validators/vmsValidator.js";

const router = Router();

// None of these routes have a logged-in user to key a limiter off of (the
// kiosk and invited-visitor landing page are public), so IP is all we have.
const vmsPublicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

// verify-invited-otp matches a submitted code against *any* pending Invited
// visitor rather than one specific visitorId, so a wrong guess can't be
// attributed to a single visitor's otpAttempts counter — that per-visitor
// lockout gives this endpoint no brute-force protection on its own. This
// tighter, IP-scoped limit is the actual guard against guessing a live code.
const vmsOtpGuessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

// Public — the kiosk and the invited-visitor landing page aren't logged in.
router.post("/create", vmsPublicLimiter, validateCreateVisitor, createVisitor);
router.post("/verify-otp", vmsPublicLimiter, validateVerifyOtp, verifyOtp);
router.post("/verify-invited-otp", vmsOtpGuessLimiter, validateVerifyInvitedOtpByCode, verifyInvitedOtpByCode);
router.post("/resend-invited-otp", vmsPublicLimiter, validateResendOtp, resendInvitedOtpByVisitorId);

// Everything else is staff-only (reception/host/admin), gated further inside
// each controller by VMS role.
router.use(protect, requireModuleAccess("vms"));

router.get("/", listVisitors);
router.get("/host/pending", getHostPendingVisitors);
router.get("/host/approved", getHostApprovedVisitors);
router.get("/host/rejected", getHostRejectedVisitors);
router.get("/invited", listInvitedVisitorsForAdmin);
router.get("/host/invited", listInvitedVisitorsForHost);

router.post("/approve", approvalAction);
router.post("/host-approve", hostApprove);
router.post("/checkin", checkIn);
router.post("/checkout", checkOut);

router.get("/:visitorId", getVisitor);

export default router;
