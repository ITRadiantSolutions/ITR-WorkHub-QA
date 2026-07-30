import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getNotifications, markAsRead, clearAll, getUnreadCount } from "../controllers/notificationController.js";
import {
  getAdminNotifications,
  getAdminUnreadCount,
  getAdminSidebarTabCounts,
  markAdminSidebarTabRead,
} from "../controllers/adminNotificationController.js";

const router = Router();
router.use(protect);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.post("/read", markAsRead);
router.delete("/clear", clearAll);

router.get("/admin", getAdminNotifications);
router.get("/admin/unread-count", getAdminUnreadCount);
router.get("/admin/tabs-counts", getAdminSidebarTabCounts);
router.post("/admin/mark-tab-read", markAdminSidebarTabRead);

export default router;
