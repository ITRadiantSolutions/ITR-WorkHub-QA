import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { listFaqs, createFaq, updateFaq, deleteFaq } from "../../controllers/timesheetFaqController.js";

const router = Router();
router.use(protect);
router.use(requireModuleAccess("timesheet"));

router.get("/", listFaqs);
router.post("/", createFaq);
router.patch("/:id", updateFaq);
router.delete("/:id", deleteFaq);

export default router;
