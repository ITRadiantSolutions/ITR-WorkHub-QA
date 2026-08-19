import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import {
  adminListSkillGroups,
  adminGetSkillGroupById,
  adminCreateSkillGroup,
  adminUpdateSkillGroup,
  adminDeleteSkillGroup,
  adminAddMembers,
  adminRemoveMember,
} from "../../controllers/lmsSkillGroupController.js";

const router = Router();

router.use(protect, requireModuleAccess("lms"));

router.get("/", adminListSkillGroups);
router.post("/", adminCreateSkillGroup);
router.get("/:id", adminGetSkillGroupById);
router.put("/:id", adminUpdateSkillGroup);
router.delete("/:id", adminDeleteSkillGroup);
router.post("/:id/members", adminAddMembers);
router.delete("/:id/members/:employeeId", adminRemoveMember);

export default router;
