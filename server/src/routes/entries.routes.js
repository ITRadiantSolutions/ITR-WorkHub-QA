import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getEntries } from "../controllers/entriesController.js";

const router = Router();
router.use(protect);
router.get("/", getEntries);

export default router;
