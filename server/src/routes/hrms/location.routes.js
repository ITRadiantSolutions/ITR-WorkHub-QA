import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import { listLocations, createLocation, updateLocation, setLocationStatus } from "../../controllers/hrmsLocationController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.get("/", listLocations);
router.post("/", allowRoles("hrms", "hr"), createLocation);
router.put("/:id", allowRoles("hrms", "hr"), updateLocation);
router.patch("/:id/status", allowRoles("hrms", "hr"), setLocationStatus);

export default router;
