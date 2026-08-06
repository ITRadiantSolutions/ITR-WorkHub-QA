import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createDraftKra,
  listDraftKras,
  addDraftKpi,
  submitDraftTemplate,
  listSubmittedTemplates,
  clearDraftKras,
} from "../controllers/draftKraController.js";

// Mirrors ITR_TimeFlow_Production's app/pms/pms_kra.py (prefix "/kras") — an
// employee's self-service KRA/KPI drafting workspace.
const router = Router();
router.use(protect);

router.post("/", createDraftKra);
router.get("/", listDraftKras);
router.post("/kpi", addDraftKpi);
router.post("/submit-template", submitDraftTemplate);
router.get("/templates/:userId", listSubmittedTemplates);
router.delete("/clear/:userId", clearDraftKras);

export default router;
