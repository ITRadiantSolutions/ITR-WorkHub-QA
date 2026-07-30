import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  listMasterTemplates,
  createMasterTemplate,
  updateMasterTemplate,
  deleteMasterTemplate,
  listUnassignedAssignees,
  submitKpiTemplateAssignment,
  updateKpiTemplateAssignment,
  updateKpiTemplateForUser,
  getAssignmentByAssignee,
} from "../controllers/legacyKraMasterTemplateController.js";

// Mirrors ITR_TimeFlow_Production's /api/kra-master-template, /api/assignees,
// and /api/kpi-template (non-per-employee) routes so CreateTemplate.jsx and
// AssignIndividual.jsx can be reused with no changes to their data-fetching code.
const router = Router();
router.use(protect);

router.get("/kra-master-template", listMasterTemplates);
router.post("/kra-master-template", createMasterTemplate);
router.put("/kra-master-template/:id", updateMasterTemplate);
router.delete("/kra-master-template/:id", deleteMasterTemplate);

router.get("/assignees/unassigned", listUnassignedAssignees);

router.get("/kpi-template", getAssignmentByAssignee);
router.post("/kpi-template/submit", submitKpiTemplateAssignment);
router.put("/kpi-template/update", updateKpiTemplateAssignment);
router.put("/kpi-template/update-by-user/:userId", updateKpiTemplateForUser);

export default router;
