import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { assertCanManageUser } from "../../utils/lmsTeamScope.js";
import {
  employeeGetCourseProgressSummary,
  employeeMarkMaterialComplete,
  employeeStartQuiz,
  employeeStartFinalAssignment,
  employeeSubmitQuiz,
  employeeSubmitFinalAssignment,
  adminGetUserCourseProgressSummary,
} from "../../controllers/lmsProgressController.js";

const router = Router();

router.use(protect, requireModuleAccess("lms"));

router.get("/courses/:courseId", employeeGetCourseProgressSummary);
router.post("/courses/:courseId/materials/:lectureId/:materialIndex", employeeMarkMaterialComplete);
router.get("/courses/:courseId/quiz/:assessmentId/start", employeeStartQuiz);
router.get("/courses/:courseId/assignment/:assessmentId/start", employeeStartFinalAssignment);
router.post("/courses/:courseId/quiz", employeeSubmitQuiz);
router.post("/courses/:courseId/assignment", employeeSubmitFinalAssignment);

router.get("/users/:userId/courses/:courseId", async (req, res, next) => {
  if (!["manager", "admin"].includes(req.user.roles.lms)) {
    return res.status(403).json({ message: "Manager/Admin access required" });
  }
  try {
    await assertCanManageUser(req.user, req.params.userId);
    return next();
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
}, adminGetUserCourseProgressSummary);

export default router;
