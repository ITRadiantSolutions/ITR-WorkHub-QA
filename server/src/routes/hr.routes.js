import { Router } from "express";
import { protect, requireModuleAccess } from "../middleware/authMiddleware.js";
import {
  getReport,
  exportReport,
  getUserReport,
  getAllUsersSummary,
  getProjectSummary,
  downloadProjectReport,
  getTimesheetStatus,
  getNsaReport,
  exportNsaReport,
  getEmployeeReport,
} from "../controllers/hrReportController.js";

const router = Router();
router.use(protect);
router.use(requireModuleAccess("timesheet"));

router.get("/report", getReport);
router.get("/report/export", exportReport);
router.get("/user-report/:userId", getUserReport);
router.get("/all-users-summary", getAllUsersSummary);
router.get("/project-summary", getProjectSummary);
router.get("/project-report/download", downloadProjectReport);
router.get("/timesheet-status", getTimesheetStatus);
router.get("/nsa-report", getNsaReport);
router.get("/nsa-report/export", exportNsaReport);
router.get("/employee-report", getEmployeeReport);

export default router;
