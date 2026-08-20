import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../../controllers/hrmsAnnouncementController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.get("/", listAnnouncements);
router.post("/", allowRoles("hrms", "hr"), createAnnouncement);
router.put("/:id", allowRoles("hrms", "hr"), updateAnnouncement);
router.delete("/:id", allowRoles("hrms", "hr"), deleteAnnouncement);

export default router;
