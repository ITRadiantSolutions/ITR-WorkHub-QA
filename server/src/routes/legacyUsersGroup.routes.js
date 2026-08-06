import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import { listGroups, getGroup, createGroup, updateGroup, deleteGroup } from "../controllers/usersGroupController.js";

// Alias for ITR_TimeFlow_Production's original /api/usersgroup path (our own
// group CRUD already lives at /api/pms/users-groups) so PMS/UserGroup.jsx can
// be reused with no changes to its data-fetching code.
const router = Router();
router.use(protect);

router.get("/", listGroups);
router.post("/", createGroup);
router.get("/:id", getGroup);
router.put("/:id", updateGroup);
router.delete("/:id", deleteGroup);

export default router;
