import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import { listDepartments, createDepartment, updateDepartment, setDepartmentStatus } from "../../controllers/hrmsDepartmentController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.get("/", listDepartments);
router.post("/", allowRoles("hrms", "hr"), createDepartment);
router.put("/:id", allowRoles("hrms", "hr"), updateDepartment);
router.patch("/:id/status", allowRoles("hrms", "hr"), setDepartmentStatus);

export default router;
