import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import {
  generatePayslip,
  generateBulkPayslips,
  listMyPayslips,
  listPayslips,
  markPayslipPaid,
  getPayslipPdf,
} from "../../controllers/hrmsPayslipController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.post("/", allowRoles("hrms", "hr"), generatePayslip);
router.post("/generate-bulk", allowRoles("hrms", "hr"), generateBulkPayslips);
router.get("/mine", listMyPayslips);
router.get("/", allowRoles("hrms", "hr"), listPayslips);
router.patch("/:id/mark-paid", allowRoles("hrms", "hr"), markPayslipPaid);
router.get("/:id/pdf", getPayslipPdf);

export default router;
