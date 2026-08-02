import { Router } from "express";
import { protect, requireModuleAccess } from "../middleware/authMiddleware.js";
import { getEntries } from "../controllers/entriesController.js";

const router = Router();
router.use(protect);
router.use(requireModuleAccess("timesheet"));
router.get("/", getEntries);

export default router;
