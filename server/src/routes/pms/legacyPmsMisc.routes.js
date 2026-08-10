import { Router } from "express";
import multer from "multer";
import { protect } from "../../middleware/authMiddleware.js";
import {
  listPmsManagers,
  getEmployeeManager,
  listAssignedTemplates,
  deleteAssignment,
  getAssignmentSingle,
  updateAssignmentWeights,
  assignTemplatesToSelf,
  getByTemplate,
  saveKraDraft,
  submitKra,
  submitEmployeeReview,
  saveActual,
  searchUserWithKra,
  getKpiTemplateHistory,
  searchUserSuggestions,
} from "../../controllers/legacyKraController.js";
import { getActiveTemplate, listTemplates } from "../../controllers/legacyCycleController.js";
import {
  getProofUrl,
  listEmployeePips,
  employeeUpdatePip,
  listAllPips,
  createPip,
  updatePipLegacy,
  getPipLegacy,
  deletePipLegacy,
  getPipEmployeeManager,
} from "../../controllers/legacyPipController.js";
import { assignPmsRoleLegacy, archivePmsUserLegacy } from "../../controllers/userController.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Mirrors ITR_TimeFlow_Production's scattered top-level PMS route prefixes
// (/api/managers, /api/kpi-template/*, /api/kra/*, /api/templates/*,
// /api/reports/employee-submit, /api/pips/*) so its Template/TemplateBody/
// TemplateCard pages can be reused with no changes to their data-fetching code.
const router = Router();
router.use(protect);

router.get("/managers", listPmsManagers);
router.get("/kpi-template/my-manager/:employeeId", getEmployeeManager);
router.get("/kpi-template/assigned/:employeeId", listAssignedTemplates);

router.get("/templates/active", getActiveTemplate);
router.get("/templates/single/:id", getAssignmentSingle);
router.put("/templates/:id", updateAssignmentWeights);
router.delete("/templates/:id", deleteAssignment);
router.post("/templates/assign", assignTemplatesToSelf);
router.get("/templates", listTemplates);

router.get("/kra/by-template/:templateId/:employeeId", getByTemplate);
router.post("/kra/draft", saveKraDraft);
router.post("/kra/submit", submitKra);
router.patch("/kra/save-actual", saveActual);

router.post("/reports/employee-submit", submitEmployeeReview);

router.get("/pips/proof-url", getProofUrl);
router.get("/pips/employee/:employeeId", listEmployeePips);
router.get("/pips/my-manager/:employeeId", getPipEmployeeManager);
router.patch("/pips/:id/employee-update", upload.any(), employeeUpdatePip);
router.get("/pips", listAllPips);
router.post("/pips", createPip);
router.put("/pips/:id", updatePipLegacy);
router.get("/pips/:id", getPipLegacy);
router.delete("/pips/:id", deletePipLegacy);

router.get("/kpi-template/search-user", searchUserWithKra);
router.get("/kpi-template/search-user-suggestions", searchUserSuggestions);
router.get("/kpi-template/history", getKpiTemplateHistory);

router.post("/assign-pms-role", assignPmsRoleLegacy);
router.patch("/pms/users/:id/archive", archivePmsUserLegacy);

export default router;
