import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import { listActivityLogs } from "../controllers/activityLogController.js";

const router = Router();
router.use(protect);
router.get("/", listActivityLogs);

export default router;
