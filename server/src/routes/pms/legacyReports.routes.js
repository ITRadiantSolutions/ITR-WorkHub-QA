import { Router } from "express";
import { protect } from "../../middleware/authMiddleware.js";
import {
  getEmployeeReport,
  getManagerEmployeeReport,
  getHrEmployeeReport,
  listManagerEmployees,
  listAllEmployeeReports,
  listHrSubmittedReports,
  listNonSubmitters,
  submitManagerReview,
  saveDraftReview,
  managerActionOnKra,
  sendToManager,
} from "../../controllers/legacyReportController.js";

// Mirrors ITR_TimeFlow_Production's scattered /api/reports/* contract so
// PMSReport.jsx/EmployeeReviewView.jsx/MyReportView.jsx can be reused with no
// changes to their data-fetching code.
const router = Router();
router.use(protect);

router.get("/employees", listAllEmployeeReports);
router.get("/non-submitters", listNonSubmitters);
router.get("/employee/:employeeId", getEmployeeReport);
router.get("/manager/:managerId/employee/:employeeId", getManagerEmployeeReport);
router.get("/manager/:managerId/employees", listManagerEmployees);
router.get("/hr/submitted", listHrSubmittedReports);
router.get("/hr/:employeeId", getHrEmployeeReport);

router.post("/manager-review", submitManagerReview);
router.post("/save-draft-review", saveDraftReview);
router.post("/manager-action", managerActionOnKra);
router.post("/employee-send-to-manager", sendToManager);

export default router;
