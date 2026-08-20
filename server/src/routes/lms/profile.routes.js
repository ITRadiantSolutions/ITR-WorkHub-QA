import { Router } from "express";
import multer from "multer";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import {
  getMyLearningProfile,
  updateMyProfile,
  uploadMyResume,
  upsertMySkill,
  removeMySkill,
  adminGetEmployeeProfile,
  adminUpsertEmployeeSkill,
  adminRemoveEmployeeSkill,
} from "../../controllers/lmsProfileController.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.use(protect, requireModuleAccess("lms"));

router.get("/me", getMyLearningProfile);
router.put("/me", updateMyProfile);
router.post("/me/resume", upload.single("file"), uploadMyResume);
router.put("/me/skills", upsertMySkill);
router.delete("/me/skills/:skillId", removeMySkill);
router.get("/admin/:employeeId", adminGetEmployeeProfile);
router.put("/admin/:employeeId/skills", adminUpsertEmployeeSkill);
router.delete("/admin/:employeeId/skills/:skillId", adminRemoveEmployeeSkill);

export default router;
