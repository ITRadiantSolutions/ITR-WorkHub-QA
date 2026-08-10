import { Router } from "express";
import rateLimit from "express-rate-limit";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { analytics, auditLogs, listUsersForKiosk, updateUserVmsRole } from "../../controllers/vmsAdminController.js";

const router = Router();

// Public, unauthenticated, and returns every active employee's name+email —
// rate limited so it can't be scraped as an email-harvesting endpoint.
const vmsKioskUsersLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

// Public — the kiosk's "who are you visiting" dropdown isn't logged in.
router.get("/users/public", vmsKioskUsersLimiter, listUsersForKiosk);

router.use(protect, requireModuleAccess("vms"));

router.get("/analytics", analytics);
router.get("/audit-logs", auditLogs);
router.patch("/users/:id/role", updateUserVmsRole);

export default router;
