import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import { objectIdParam } from "../../middleware/validateObjectId.js";
import {
  listStories,
  getStory,
  createStory,
  updateStory,
  getStoryComments,
  addStoryComment,
  getSprintTotalStoryPoints,
  deleteStory,
} from "../../controllers/storyController.js";

const router = Router();
router.use(protect, requireModuleAccess("tracker"));
router.param("id", objectIdParam);
router.param("sprintId", objectIdParam);

router.get("/", listStories);
router.post("/", allowRoles("tracker", "ADMIN", "PM", "DEVELOPER", "QA"), createStory);
router.get("/total/:sprintId", getSprintTotalStoryPoints);
router.get("/:id", getStory);
router.put("/:id", allowRoles("tracker", "ADMIN", "PM", "QA", "DEVELOPER"), updateStory);
router.get("/:id/comments", getStoryComments);
router.post("/:id/comments", addStoryComment);
router.delete("/:id", allowRoles("tracker", "ADMIN", "PM"), deleteStory);

export default router;
