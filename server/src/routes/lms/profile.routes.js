import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { getMyLearningProfile } from "../../controllers/lmsProfileController.js";

const router = Router();

router.use(protect, requireModuleAccess("lms"));

router.get("/me", getMyLearningProfile);

export default router;
