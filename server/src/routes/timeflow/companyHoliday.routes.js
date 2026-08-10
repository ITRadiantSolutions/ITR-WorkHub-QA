import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { listCompanyHolidays, addCompanyHoliday, removeCompanyHoliday } from "../../controllers/companyHolidayController.js";

const router = Router();
router.use(protect);
router.use(requireModuleAccess("timesheet"));

router.get("/", listCompanyHolidays);
router.post("/", addCompanyHoliday);
router.delete("/:date", removeCompanyHoliday);

export default router;
