import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  listMyTimesheets,
  getTimesheet,
  saveDraft,
  submitTimesheet,
  managerAction,
  clearWeek,
  managerTimesheets,
  managerTimesheetById,
  managerTimesheetStatus,
} from "../controllers/timesheetController.js";

const router = Router();
router.use(protect);

router.get("/", listMyTimesheets);
router.post("/save", saveDraft);
router.get("/manager", managerTimesheets);
router.get("/manager/status", managerTimesheetStatus);
router.get("/manager/:id", managerTimesheetById);
router.delete("/week/:weekStart/clear", clearWeek);
router.get("/:id", getTimesheet);
router.post("/:id/submit", submitTimesheet);
router.post("/:id/:action", managerAction);

export default router;
