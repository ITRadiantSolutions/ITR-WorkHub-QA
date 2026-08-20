import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import { listLeaveTypes, createLeaveType, updateLeaveType, setLeaveTypeStatus } from "../../controllers/hrmsLeaveTypeController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.get("/", listLeaveTypes);
router.post("/", allowRoles("hrms", "hr"), createLeaveType);
router.put("/:id", allowRoles("hrms", "hr"), updateLeaveType);
router.patch("/:id/status", allowRoles("hrms", "hr"), setLeaveTypeStatus);

export default router;
