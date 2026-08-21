import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import {
  listDesignations,
  createDesignation,
  updateDesignation,
  setDesignationStatus,
  importDesignationsFromUsers,
} from "../../controllers/hrmsDesignationController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.get("/", listDesignations);
router.post("/", allowRoles("hrms", "hr"), createDesignation);
router.post("/import-from-users", allowRoles("hrms", "hr"), importDesignationsFromUsers);
router.put("/:id", allowRoles("hrms", "hr"), updateDesignation);
router.patch("/:id/status", allowRoles("hrms", "hr"), setDesignationStatus);

export default router;
