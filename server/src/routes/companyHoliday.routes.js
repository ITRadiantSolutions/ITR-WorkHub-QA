import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import { listCompanyHolidays, addCompanyHoliday, removeCompanyHoliday } from "../controllers/companyHolidayController.js";

const router = Router();
router.use(protect);

router.get("/", listCompanyHolidays);
router.post("/", addCompanyHoliday);
router.delete("/:date", removeCompanyHoliday);

export default router;
