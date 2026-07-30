import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectEmployees,
  getProjectSprints,
  updateTeamMembers,
  addTeamMember,
  removeTeamMember,
  addHoliday,
  removeHoliday,
  holidaysByProjectIds,
} from "../controllers/projectController.js";
import { uploadProjectAttachments } from "../controllers/projectAttachmentsController.js";
import { cloneProject } from "../controllers/projectCloneController.js";

const router = Router();
router.use(protect);

router.get("/", listProjects);
router.get("/search", listProjects);
router.post("/", createProject);
router.post("/holidays-by-projects", holidaysByProjectIds);

router.get("/:projectId/employees", getProjectEmployees);
router.get("/:id/sprints", getProjectSprints);
router.patch("/:id/team-members", updateTeamMembers);
router.post("/:id/attachments", uploadProjectAttachments);
router.post("/:id/clone", cloneProject);

router.get("/:id", getProject);
router.put("/:id", updateProject);
router.delete("/:id", deleteProject);

router.post("/:id/team", addTeamMember);
router.delete("/:id/team/:userId", removeTeamMember);

router.post("/:id/holidays", addHoliday);
router.delete("/:id/holidays/:date", removeHoliday);

export default router;
