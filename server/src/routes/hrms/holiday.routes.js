import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import { listHolidays, addHoliday, removeHoliday } from "../../controllers/hrmsHolidayController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.get("/", listHolidays);
router.post("/", allowRoles("hrms", "hr"), addHoliday);
router.delete("/:date", allowRoles("hrms", "hr"), removeHoliday);

export default router;
