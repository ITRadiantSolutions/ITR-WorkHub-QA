import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { analytics, auditLogs, listUsersForKiosk, updateUserVmsRole } from "../../controllers/vmsAdminController.js";

const router = Router();

// Public — the kiosk's "who are you visiting" dropdown isn't logged in.
router.get("/users/public", listUsersForKiosk);

router.use(protect, requireModuleAccess("vms"));

router.get("/analytics", analytics);
router.get("/audit-logs", auditLogs);
router.patch("/users/:id/role", updateUserVmsRole);

export default router;
