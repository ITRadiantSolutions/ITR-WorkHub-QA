import { Router } from "express";
import multer from "multer";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  acknowledgeAnnouncement,
  getAnnouncementAttachmentUrl,
} from "../../controllers/hrmsAnnouncementController.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.get("/", listAnnouncements);
router.post("/", allowRoles("hrms", "hr"), upload.single("attachment"), createAnnouncement);
router.put("/:id", allowRoles("hrms", "hr"), upload.single("attachment"), updateAnnouncement);
router.delete("/:id", allowRoles("hrms", "hr"), deleteAnnouncement);
router.post("/:id/acknowledge", acknowledgeAnnouncement);
router.get("/:id/attachment-url", getAnnouncementAttachmentUrl);

export default router;
