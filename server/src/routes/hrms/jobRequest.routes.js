import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import {
  createJobRequest,
  listJobRequests,
  getJobRequest,
  updateJobRequest,
  reviewJobRequest,
  addClarification,
  respondClarification,
  publishFromJobRequest,
} from "../../controllers/hrmsJobRequestController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.get("/", listJobRequests);
router.post("/", allowRoles("hrms", "manager"), createJobRequest);
router.get("/:id", getJobRequest);
router.put("/:id", updateJobRequest);
router.post("/:id/review", allowRoles("hrms", "hr"), reviewJobRequest);
router.post("/:id/clarification", allowRoles("hrms", "hr"), addClarification);
router.post("/:id/clarification/respond", respondClarification);
router.post("/:id/publish", allowRoles("hrms", "hr"), publishFromJobRequest);

export default router;
