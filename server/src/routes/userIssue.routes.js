import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { objectIdParam } from "../middleware/validateObjectId.js";
import { listUserIssues, createUserIssue, resolveUserIssue } from "../controllers/userIssueController.js";

const router = Router();
router.use(protect);
router.param("id", objectIdParam);

router.get("/", allowRoles("tracker", "ADMIN"), listUserIssues);
router.post("/", createUserIssue);
router.patch("/:id/resolve", allowRoles("tracker", "ADMIN"), resolveUserIssue);

export default router;
