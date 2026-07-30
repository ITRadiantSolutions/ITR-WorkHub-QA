import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import { listBugs, getBug, createBug, updateBug, deleteBug } from "../controllers/bugController.js";

const router = Router();
router.use(protect);

router.get("/", listBugs);
router.post("/", createBug);
router.get("/:id", getBug);
router.put("/:id", updateBug);
router.delete("/:id", deleteBug);

export default router;
