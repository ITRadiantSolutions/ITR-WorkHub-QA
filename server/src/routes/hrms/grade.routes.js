import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import { listGrades, createGrade, updateGrade, setGradeStatus } from "../../controllers/hrmsGradeController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.get("/", listGrades);
router.post("/", allowRoles("hrms", "hr"), createGrade);
router.put("/:id", allowRoles("hrms", "hr"), updateGrade);
router.patch("/:id/status", allowRoles("hrms", "hr"), setGradeStatus);

export default router;
