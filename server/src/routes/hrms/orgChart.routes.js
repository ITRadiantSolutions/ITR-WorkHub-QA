import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { getOrgChart } from "../../controllers/hrmsEmployeeController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"));
router.get("/", getOrgChart);

export default router;
