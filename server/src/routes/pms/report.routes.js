import { Router } from "express";
import { protect } from "../../middleware/authMiddleware.js";
import { getCycleReport, exportCycleReport, getEmployeeReport, listNonSubmitters } from "../../controllers/pmsReportController.js";

const router = Router();
router.use(protect);

router.get("/cycle", getCycleReport);
router.get("/cycle/export", exportCycleReport);
router.get("/employee/:employeeId", getEmployeeReport);
router.get("/non-submitters", listNonSubmitters);

export default router;
