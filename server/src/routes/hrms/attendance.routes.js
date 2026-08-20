import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import { requireDeviceApiKey } from "../../middleware/deviceAuthMiddleware.js";
import {
  recordPunch,
  manualPunch,
  listAttendance,
  getDailySummary,
  getEmployeePunches,
  getMyAttendance,
  regularizeDay,
} from "../../controllers/hrmsAttendanceController.js";

const router = Router();

// Device-facing ingest — authenticated via a shared API key (see
// deviceAuthMiddleware.js), not a user session, so it sits before the
// protect() gate below.
router.post("/punch", requireDeviceApiKey, recordPunch);

router.use(protect, requireModuleAccess("hrms"));

router.get("/mine", getMyAttendance);
router.get("/summary", allowRoles("hrms", "hr", "manager"), getDailySummary);
router.get("/", allowRoles("hrms", "hr", "manager"), listAttendance);
router.get("/:employeeId/punches", allowRoles("hrms", "hr", "manager"), getEmployeePunches);
router.post("/manual", allowRoles("hrms", "hr"), manualPunch);
router.patch("/:id/regularize", allowRoles("hrms", "hr"), regularizeDay);

export default router;
