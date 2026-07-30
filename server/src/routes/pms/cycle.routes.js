import { Router } from "express";
import { protect } from "../../middleware/authMiddleware.js";
import {
  listCycles,
  getCycle,
  createCycle,
  updateCycle,
  deleteCycle,
  setEmployeeResponseWindow,
  setManagerResponseWindow,
  setReportVisibility,
} from "../../controllers/cycleController.js";

const router = Router();
router.use(protect);

router.get("/", listCycles);
router.post("/", createCycle);
router.get("/:id", getCycle);
router.put("/:id", updateCycle);
router.delete("/:id", deleteCycle);
router.patch("/:id/employee-response", setEmployeeResponseWindow);
router.patch("/:id/manager-response", setManagerResponseWindow);
router.patch("/:id/report-visibility", setReportVisibility);

export default router;
