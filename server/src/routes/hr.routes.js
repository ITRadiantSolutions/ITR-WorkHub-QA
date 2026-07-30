import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getReport,
  exportReport,
  getUserReport,
  getAllUsersSummary,
  getProjectSummary,
  downloadProjectReport,
} from "../controllers/hrReportController.js";

const router = Router();
router.use(protect);

router.get("/report", getReport);
router.get("/report/export", exportReport);
router.get("/user-report/:userId", getUserReport);
router.get("/all-users-summary", getAllUsersSummary);
router.get("/project-summary", getProjectSummary);
router.get("/project-report/download", downloadProjectReport);

export default router;
