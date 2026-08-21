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
  createRegularizationRequest,
  listMyRegularizationRequests,
  listTeamRegularizationRequests,
  listRegularizationRequests,
  reviewRegularizationRequest,
} from "../../controllers/hrmsAttendanceController.js";

const router = Router();

// Device-facing ingest — authenticated via a shared API key (see
// deviceAuthMiddleware.js), not a user session, so it sits before the
// protect() gate below.
router.post("/punch", requireDeviceApiKey, recordPunch);

router.use(protect, requireModuleAccess("hrms"));

router.get("/mine", getMyAttendance);
router.get("/summary", allowRoles("hrms", "hr", "manager"), getDailySummary);

// Self-service regularization requests — literal paths registered ahead of
// the /:employeeId/punches param route below, though "punches" as the fixed
// second segment there means there's no actual overlap either way.
router.post("/requests", createRegularizationRequest);
router.get("/requests/mine", listMyRegularizationRequests);
router.get("/requests/team", allowRoles("hrms", "manager"), listTeamRegularizationRequests);
router.get("/requests", allowRoles("hrms", "hr"), listRegularizationRequests);
router.patch("/requests/:id/review", allowRoles("hrms", "manager", "hr"), reviewRegularizationRequest);

router.get("/", allowRoles("hrms", "hr", "manager"), listAttendance);
router.get("/:employeeId/punches", allowRoles("hrms", "hr", "manager"), getEmployeePunches);
router.post("/manual", allowRoles("hrms", "hr"), manualPunch);
router.patch("/:id/regularize", allowRoles("hrms", "hr"), regularizeDay);

export default router;
