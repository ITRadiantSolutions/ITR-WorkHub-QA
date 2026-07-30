import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getAdminLogsSummary } from "../controllers/activityLogController.js";

const router = Router();
router.use(protect);
router.get("/", getAdminLogsSummary);

export default router;
