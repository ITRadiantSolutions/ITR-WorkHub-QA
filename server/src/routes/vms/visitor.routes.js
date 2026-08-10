import { Router } from "express";
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

const router = Router();

// Public — the kiosk and the invited-visitor landing page aren't logged in.
router.post("/create", createVisitor);
router.post("/verify-otp", verifyOtp);
router.post("/verify-invited-otp", verifyInvitedOtpByCode);
router.post("/resend-invited-otp", resendInvitedOtpByVisitorId);

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
