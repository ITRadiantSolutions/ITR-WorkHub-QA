import { Router } from "express";
import { protect } from "../../middleware/authMiddleware.js";
import { listGroups, getGroup, createGroup, updateGroup, deleteGroup } from "../../controllers/usersGroupController.js";

const router = Router();
router.use(protect);

router.get("/", listGroups);
router.post("/", createGroup);
router.get("/:id", getGroup);
router.put("/:id", updateGroup);
router.delete("/:id", deleteGroup);

export default router;
