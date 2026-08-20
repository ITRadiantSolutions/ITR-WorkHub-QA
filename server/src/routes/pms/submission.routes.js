import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import {
  listSubmissions,
  getSubmission,
  getOrCreateFromAssignment,
  saveResponses,
  employeeSubmit,
  managerReview,
  setFinalReport,
} from "../../controllers/submissionController.js";

const router = Router();
router.use(protect, requireModuleAccess("pms"));

router.get("/", listSubmissions);
router.post("/from-assignment/:assignmentId", getOrCreateFromAssignment);
router.get("/:id", getSubmission);
router.put("/:id/responses", saveResponses);
router.post("/:id/employee-submit", employeeSubmit);
router.post("/:id/manager-review", managerReview);
router.patch("/:id/final-report", setFinalReport);

export default router;
