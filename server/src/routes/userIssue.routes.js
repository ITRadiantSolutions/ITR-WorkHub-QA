import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import { listUserIssues, createUserIssue, resolveUserIssue } from "../controllers/userIssueController.js";

const router = Router();
router.use(protect);

router.get("/", listUserIssues);
router.post("/", createUserIssue);
router.patch("/:id/resolve", resolveUserIssue);

export default router;
