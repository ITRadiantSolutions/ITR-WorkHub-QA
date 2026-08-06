import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  listCycles,
  getCycleLegacy,
  createCycle,
  updateCycle,
  deleteCycle,
  toggleResponse,
  updateReportVisibility,
  toggleUserReportAccess,
} from "../controllers/legacyCycleController.js";

// Mirrors ITR_TimeFlow_Production's original /api/cycles/ contract exactly
// (flat fields, these specific sub-paths) so its PMS/cycles/Cycle.jsx page
// can be reused with no changes to its data-fetching code.
const router = Router();
router.use(protect);

router.get("/", listCycles);
router.post("/", createCycle);
router.get("/:id", getCycleLegacy);
router.put("/:id", updateCycle);
router.delete("/:id", deleteCycle);
router.patch("/:id/toggle-response", toggleResponse);
router.patch("/:id/report-visibility", updateReportVisibility);
router.patch("/:id/report-visibility-toggle-user", toggleUserReportAccess);

export default router;
