import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import {
  adminListSkillTests,
  adminGetSkillTestById,
  adminCreateSkillTest,
  adminGenerateSkillTest,
  adminUpdateSkillTest,
  adminDeleteSkillTest,
  adminAssignToGroups,
  adminUnassignGroup,
  employeeListAvailableTests,
  employeeStartAttempt,
  employeeSubmitAttempt,
  employeeGetProgress,
} from "../../controllers/lmsSkillTestController.js";

const router = Router();

router.use(protect, requireModuleAccess("lms"));

// Admin authoring
router.get("/admin", adminListSkillTests);
router.post("/admin", adminCreateSkillTest);
router.post("/admin/generate", adminGenerateSkillTest);
router.get("/admin/:testId", adminGetSkillTestById);
router.put("/admin/:testId", adminUpdateSkillTest);
router.delete("/admin/:testId", adminDeleteSkillTest);
router.post("/admin/:testId/assign", adminAssignToGroups);
router.delete("/admin/:testId/assign/:groupId", adminUnassignGroup);

// Employee-facing
router.get("/available", employeeListAvailableTests);
router.post("/:testId/start", employeeStartAttempt);
router.post("/:testId/submit", employeeSubmitAttempt);
router.get("/:testId/progress", employeeGetProgress);

export default router;
