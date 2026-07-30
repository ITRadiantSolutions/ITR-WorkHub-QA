import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  listSprints,
  getSprint,
  createSprint,
  updateSprint,
  getSprintComments,
  addSprintComment,
  deleteSprint,
} from "../controllers/sprintController.js";

const router = Router();
router.use(protect);

router.get("/", listSprints);
router.post("/", createSprint);
router.get("/:id", getSprint);
router.put("/:id", updateSprint);
router.get("/:id/comments", getSprintComments);
router.post("/:id/comments", addSprintComment);
router.delete("/:id", deleteSprint);

export default router;
