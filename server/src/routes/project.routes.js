import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { objectIdParam } from "../middleware/validateObjectId.js";
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
  bulkAddTeamMembers,
  addHoliday,
  removeHoliday,
  addExcludedHoliday,
  removeExcludedHoliday,
  holidaysByProjectIds,
} from "../controllers/projectController.js";
import { uploadProjectAttachments } from "../controllers/projectAttachmentsController.js";
import { cloneProject } from "../controllers/projectCloneController.js";

const router = Router();
router.use(protect);
router.param("id", objectIdParam);
router.param("projectId", objectIdParam);
router.param("userId", objectIdParam);

router.get("/", listProjects);
router.get("/search", listProjects);
router.post("/", allowRoles("tracker", "ADMIN", "PM"), createProject);
router.post("/holidays-by-projects", holidaysByProjectIds);

router.get("/:projectId/employees", allowRoles("tracker", "ADMIN", "PM", "DEVELOPER", "QA"), getProjectEmployees);
router.get("/:id/sprints", getProjectSprints);
router.patch("/:id/team-members", allowRoles("tracker", "ADMIN", "PM"), updateTeamMembers);
router.post("/:id/attachments", allowRoles("tracker", "ADMIN", "PM"), uploadProjectAttachments);
router.post("/:id/clone", allowRoles("tracker", "ADMIN", "PM"), cloneProject);

router.get("/:id", getProject);
router.put("/:id", allowRoles("tracker", "ADMIN", "PM"), updateProject);
router.delete("/:id", allowRoles("tracker", "ADMIN", "PM"), deleteProject);

router.post("/team/bulk-add", bulkAddTeamMembers);
router.post("/:id/team", addTeamMember);
router.delete("/:id/team/:userId", removeTeamMember);

router.post("/:id/holidays", allowRoles("tracker", "ADMIN", "PM"), addHoliday);
router.delete("/:id/holidays/:date", allowRoles("tracker", "ADMIN", "PM"), removeHoliday);
router.post("/:id/excluded-holidays", allowRoles("tracker", "ADMIN", "PM"), addExcludedHoliday);
router.delete("/:id/excluded-holidays/:date", allowRoles("tracker", "ADMIN", "PM"), removeExcludedHoliday);

export default router;
