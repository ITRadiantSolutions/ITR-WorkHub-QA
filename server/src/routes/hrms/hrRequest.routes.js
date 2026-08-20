import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import {
  createHrRequest,
  listMyHrRequests,
  listHrRequests,
  assignHrRequest,
  resolveHrRequest,
} from "../../controllers/hrmsHrRequestController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.post("/", createHrRequest);
router.get("/mine", listMyHrRequests);
router.get("/", allowRoles("hrms", "hr"), listHrRequests);
router.patch("/:id/assign", allowRoles("hrms", "hr"), assignHrRequest);
router.patch("/:id/resolve", allowRoles("hrms", "hr"), resolveHrRequest);

export default router;
