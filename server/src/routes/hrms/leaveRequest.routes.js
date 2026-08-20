import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import {
  createLeaveRequest,
  listMyLeaveRequests,
  listTeamLeaveRequests,
  listLeaveRequests,
  getMyLeaveBalance,
  getLeaveBalanceForEmployee,
  getLeaveCalendar,
  getLeaveLedger,
  reviewLeaveRequest,
  cancelLeaveRequest,
} from "../../controllers/hrmsLeaveRequestController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.post("/", createLeaveRequest);
router.get("/mine", listMyLeaveRequests);
router.get("/my-balance", getMyLeaveBalance);
router.get("/balance/:employeeId", allowRoles("hrms", "hr"), getLeaveBalanceForEmployee);
router.get("/ledger/:leaveTypeId", getLeaveLedger);
router.get("/calendar", getLeaveCalendar);
router.get("/team", allowRoles("hrms", "manager"), listTeamLeaveRequests);
router.get("/", allowRoles("hrms", "hr"), listLeaveRequests);
router.patch("/:id/review", allowRoles("hrms", "manager", "hr"), reviewLeaveRequest);
router.patch("/:id/cancel", cancelLeaveRequest);

export default router;
