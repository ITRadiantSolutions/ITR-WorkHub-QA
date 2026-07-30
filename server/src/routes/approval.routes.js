import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getUserStatus,
  listPendingUsers,
  listRejectedUsers,
  listEditedUsers,
  approveUser,
  rejectUser,
  reApproveUser,
  updateUserAsAdmin,
} from "../controllers/approvalController.js";
import { getMicrosoftLoginLogs, getMicrosoftLoginErrors } from "../controllers/activityLogController.js";

const router = Router();

// Matches Flow_Tracker's original auth.route.js path/method conventions exactly,
// since this mounts alongside auth.routes.js under /api/auth.
router.get("/status/:email", getUserStatus);

router.use(protect);
router.get("/pending-users", listPendingUsers);
router.get("/rejected-users", listRejectedUsers);
router.get("/edited-users", listEditedUsers);
router.put("/:id/approve", approveUser);
router.put("/:id/reject", rejectUser);
router.put("/:id/re-approve", reApproveUser);
router.put("/:id/update", updateUserAsAdmin);
router.get("/microsoft-login-logs", getMicrosoftLoginLogs);
router.get("/microsoft-login-errors", getMicrosoftLoginErrors);

export default router;
