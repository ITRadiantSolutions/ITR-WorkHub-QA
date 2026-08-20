import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import { objectIdParam } from "../../middleware/validateObjectId.js";
import { listBugs, getBug, createBug, updateBug, deleteBug } from "../../controllers/bugController.js";

const router = Router();
router.use(protect, requireModuleAccess("tracker"));
router.param("id", objectIdParam);

router.get("/", listBugs);
router.post("/", allowRoles("tracker", "QA", "DEVELOPER", "PM", "ADMIN"), createBug);
router.get("/:id", getBug);
router.put("/:id", updateBug);
router.delete("/:id", allowRoles("tracker", "ADMIN", "PM"), deleteBug);

export default router;
