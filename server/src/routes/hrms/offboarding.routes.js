import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import {
  initiateOffboarding,
  listOffboarding,
  getMyOffboarding,
  recordExitInterview,
  processFinalSettlement,
} from "../../controllers/hrmsOffboardingController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.post("/", allowRoles("hrms", "hr"), initiateOffboarding);
router.get("/", allowRoles("hrms", "hr"), listOffboarding);
router.get("/mine", getMyOffboarding);
router.patch("/:id/exit-interview", allowRoles("hrms", "hr"), recordExitInterview);
router.patch("/:id/final-settlement", allowRoles("hrms", "hr"), processFinalSettlement);

export default router;
