import { Router } from "express";
import { protect } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import { objectIdParam } from "../../middleware/validateObjectId.js";
import {
  listSprints,
  getSprint,
  createSprint,
  updateSprint,
  getSprintComments,
  addSprintComment,
  deleteSprint,
} from "../../controllers/sprintController.js";

const router = Router();
router.use(protect);
router.param("id", objectIdParam);

router.get("/", listSprints);
router.post("/", allowRoles("tracker", "ADMIN", "PM"), createSprint);
router.get("/:id", getSprint);
router.put("/:id", allowRoles("tracker", "ADMIN", "PM"), updateSprint);
router.get("/:id/comments", getSprintComments);
router.post("/:id/comments", addSprintComment);
router.delete("/:id", allowRoles("tracker", "ADMIN", "PM"), deleteSprint);

export default router;
