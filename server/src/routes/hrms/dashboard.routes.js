import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { getDashboardStats } from "../../controllers/hrmsDashboardController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"));
router.get("/stats", getDashboardStats);

export default router;
