import { Router } from "express";
import multer from "multer";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import {
  createSkill,
  getSkills,
  getSkillById,
  updateSkill,
  deleteSkill,
  changeSkillStatus,
  bulkImportSkills,
  getSkillCategories,
  createSkillCategory,
  bulkCreateSkillCategories,
  deleteSkillCategory,
} from "../../controllers/lmsSkillController.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.use(protect, requireModuleAccess("lms"));

router.get("/categories", getSkillCategories);
router.post("/categories", createSkillCategory);
router.post("/categories/bulk", bulkCreateSkillCategories);
router.delete("/categories/:id", deleteSkillCategory);

router.post("/bulk-import", upload.single("file"), bulkImportSkills);

router.get("/", getSkills);
router.post("/", createSkill);
router.get("/:id", getSkillById);
router.put("/:id", updateSkill);
router.delete("/:id", deleteSkill);
router.patch("/:id/status", changeSkillStatus);

export default router;
