import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import { startOnboarding, listOnboarding, getMyOnboarding, setOnboardingItem } from "../../controllers/hrmsOnboardingController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.post("/", allowRoles("hrms", "hr"), startOnboarding);
router.get("/", allowRoles("hrms", "hr"), listOnboarding);
router.get("/mine", getMyOnboarding);
router.patch("/:id/items/:itemId", allowRoles("hrms", "hr"), setOnboardingItem);

export default router;
