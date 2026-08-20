import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import {
  listJobPosts,
  getJobPost,
  createJobPost,
  updateJobPost,
  publishJobPost,
  closeJobPost,
  archiveJobPost,
} from "../../controllers/hrmsJobPostController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.get("/", listJobPosts);
router.post("/", allowRoles("hrms", "hr", "recruiter"), createJobPost);
router.get("/:id", getJobPost);
router.put("/:id", allowRoles("hrms", "hr", "recruiter"), updateJobPost);
router.patch("/:id/publish", allowRoles("hrms", "hr", "recruiter"), publishJobPost);
router.patch("/:id/close", allowRoles("hrms", "hr", "recruiter"), closeJobPost);
router.patch("/:id/archive", allowRoles("hrms", "hr", "recruiter"), archiveJobPost);

export default router;
