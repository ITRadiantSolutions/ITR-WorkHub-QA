import { Router } from "express";
import multer from "multer";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import {
  createReferral,
  listMyReferrals,
  listAllReferrals,
  updateReferralStatus,
  getResumeUrl,
} from "../../controllers/hrmsReferralController.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.get("/mine", listMyReferrals);
router.get("/", allowRoles("hrms", "hr"), listAllReferrals);
router.post("/", upload.single("resume"), createReferral);
router.patch("/:id/status", allowRoles("hrms", "hr"), updateReferralStatus);
router.get("/:id/resume-url", getResumeUrl);

export default router;
