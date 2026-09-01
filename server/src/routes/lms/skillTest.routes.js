import { Router } from "express";
import multer from "multer";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import {
  adminListSkillTests,
  adminGetSkillTestById,
  adminCreateSkillTest,
  adminGenerateSkillTest,
  adminParseQuestions,
  adminUpdateSkillTest,
  adminDeleteSkillTest,
  adminAssignToGroups,
  adminUnassignGroup,
  adminGetTestResults,
  employeeListAvailableTests,
  employeeStartAttempt,
  employeeSubmitAttempt,
  employeeGetProgress,
  employeeGetLastReview,
} from "../../controllers/lmsSkillTestController.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

router.use(protect, requireModuleAccess("lms"));

// Admin authoring
router.get("/admin", adminListSkillTests);
router.post("/admin", adminCreateSkillTest);
router.post("/admin/generate", adminGenerateSkillTest);
router.post("/admin/parse-questions", upload.single("file"), adminParseQuestions);
router.get("/admin/:testId", adminGetSkillTestById);
router.get("/admin/:testId/results", adminGetTestResults);
router.put("/admin/:testId", adminUpdateSkillTest);
router.delete("/admin/:testId", adminDeleteSkillTest);
router.post("/admin/:testId/assign", adminAssignToGroups);
router.delete("/admin/:testId/assign/:groupId", adminUnassignGroup);

// Employee-facing
router.get("/available", employeeListAvailableTests);
router.post("/:testId/start", employeeStartAttempt);
router.post("/:testId/submit", employeeSubmitAttempt);
router.get("/:testId/progress", employeeGetProgress);
router.get("/:testId/review", employeeGetLastReview);

export default router;
