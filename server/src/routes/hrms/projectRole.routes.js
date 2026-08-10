import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import { listProjectRoles, upsertProjectRole, deleteProjectRole } from "../../controllers/hrmsProjectRoleController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.get("/", listProjectRoles);
router.put("/", allowRoles("hrms", "hr", "manager"), upsertProjectRole);
router.delete("/:id", allowRoles("hrms", "hr", "manager"), deleteProjectRole);

export default router;
