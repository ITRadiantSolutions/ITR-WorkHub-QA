import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  listStories,
  getStory,
  createStory,
  updateStory,
  getStoryComments,
  addStoryComment,
  getSprintTotalStoryPoints,
  deleteStory,
} from "../controllers/storyController.js";

const router = Router();
router.use(protect);

router.get("/", listStories);
router.post("/", createStory);
router.get("/total/:sprintId", getSprintTotalStoryPoints);
router.get("/:id", getStory);
router.put("/:id", updateStory);
router.get("/:id/comments", getStoryComments);
router.post("/:id/comments", addStoryComment);
router.delete("/:id", deleteStory);

export default router;
