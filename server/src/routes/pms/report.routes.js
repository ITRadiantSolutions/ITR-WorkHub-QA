import { Router } from "express";
import { protect } from "../../middleware/authMiddleware.js";
import { getCycleReport, exportCycleReport, getEmployeeReport } from "../../controllers/pmsReportController.js";

const router = Router();
router.use(protect);

router.get("/cycle", getCycleReport);
router.get("/cycle/export", exportCycleReport);
router.get("/employee/:employeeId", getEmployeeReport);

export default router;
