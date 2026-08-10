import { Router } from "express";
import multer from "multer";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { createBadge, getAllBadges, getAllBadgesAdmin, getBadgeById, updateBadge, deleteBadge } from "../../controllers/lmsBadgeController.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.use(protect, requireModuleAccess("lms"));

router.get("/", getAllBadges);
router.get("/admin", getAllBadgesAdmin);
router.post("/admin", upload.single("image"), createBadge);
router.get("/admin/:badgeId", getBadgeById);
router.put("/admin/:badgeId", upload.single("image"), updateBadge);
router.delete("/admin/:badgeId", deleteBadge);

export default router;
