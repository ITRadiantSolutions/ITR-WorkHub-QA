import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import { listEmployees, getEmployeeProfile, updateEmployeeHrFields } from "../../controllers/hrmsEmployeeController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"), allowRoles("hrms", "hr"));

router.get("/", listEmployees);
router.get("/:id", getEmployeeProfile);
router.patch("/:id", updateEmployeeHrFields);

export default router;
