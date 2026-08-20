import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import { upsertSalaryStructure, getSalaryStructure } from "../../controllers/hrmsSalaryStructureController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.put("/", allowRoles("hrms", "hr"), upsertSalaryStructure);
router.get("/:employeeId", getSalaryStructure);

export default router;
