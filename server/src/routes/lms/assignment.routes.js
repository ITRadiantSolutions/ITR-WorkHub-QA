import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import {
  adminListEmployees,
  adminAssignCourseToEmployees,
  adminGetAssignmentInfo,
  adminGetCourseAssignments,
} from "../../controllers/lmsAssignmentController.js";

const router = Router();

router.use(protect, requireModuleAccess("lms"));

router.get("/employees", adminListEmployees);
router.get("/info", adminGetAssignmentInfo);
router.get("/courses/:courseId", adminGetCourseAssignments);
router.post("/", adminAssignCourseToEmployees);

export default router;
