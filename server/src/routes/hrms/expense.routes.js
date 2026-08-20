import { Router } from "express";
import multer from "multer";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import {
  createExpense,
  listMyExpenses,
  listTeamExpenses,
  listExpenses,
  reviewExpense,
  markExpenseReimbursed,
  getBillUrl,
} from "../../controllers/hrmsExpenseController.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.post("/", upload.single("bill"), createExpense);
router.get("/mine", listMyExpenses);
router.get("/team", allowRoles("hrms", "manager"), listTeamExpenses);
router.get("/", allowRoles("hrms", "hr"), listExpenses);
router.patch("/:id/review", allowRoles("hrms", "manager", "hr"), reviewExpense);
router.patch("/:id/reimburse", allowRoles("hrms", "hr"), markExpenseReimbursed);
router.get("/:id/bill-url", getBillUrl);

export default router;
