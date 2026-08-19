import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import {
  getMyLearningProfile,
  adminGetEmployeeProfile,
  adminUpsertEmployeeSkill,
  adminRemoveEmployeeSkill,
} from "../../controllers/lmsProfileController.js";

const router = Router();

router.use(protect, requireModuleAccess("lms"));

router.get("/me", getMyLearningProfile);
router.get("/admin/:employeeId", adminGetEmployeeProfile);
router.put("/admin/:employeeId/skills", adminUpsertEmployeeSkill);
router.delete("/admin/:employeeId/skills/:skillId", adminRemoveEmployeeSkill);

export default router;
