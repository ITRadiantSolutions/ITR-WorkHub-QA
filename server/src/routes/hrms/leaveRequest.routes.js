import { Router } from "express";
import multer from "multer";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import {
  createLeaveRequest,
  createLeaveRequestForEmployee,
  listMyLeaveRequests,
  listTeamLeaveRequests,
  listLeaveRequests,
  getMyLeaveBalance,
  getLeaveBalanceForEmployee,
  getLeaveCalendar,
  getLeaveLedger,
  getLeaveDocumentUrl,
  grantLeave,
  reviewLeaveRequest,
  cancelLeaveRequest,
} from "../../controllers/hrmsLeaveRequestController.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.post("/", upload.single("document"), createLeaveRequest);
router.post("/for-employee", allowRoles("hrms", "hr"), upload.single("document"), createLeaveRequestForEmployee);
router.post("/grant", allowRoles("hrms", "hr"), grantLeave);
router.get("/mine", listMyLeaveRequests);
router.get("/my-balance", getMyLeaveBalance);
router.get("/balance/:employeeId", allowRoles("hrms", "hr"), getLeaveBalanceForEmployee);
router.get("/ledger/:leaveTypeId", getLeaveLedger);
router.get("/calendar", getLeaveCalendar);
router.get("/team", allowRoles("hrms", "manager"), listTeamLeaveRequests);
router.get("/", allowRoles("hrms", "hr"), listLeaveRequests);
router.get("/:id/document-url", getLeaveDocumentUrl);
router.patch("/:id/review", allowRoles("hrms", "manager", "hr"), reviewLeaveRequest);
router.patch("/:id/cancel", cancelLeaveRequest);

export default router;
