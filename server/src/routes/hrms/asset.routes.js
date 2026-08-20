import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import { listAssets, createAsset, updateAsset, setAssetStatus } from "../../controllers/hrmsAssetController.js";
import {
  assignAsset,
  returnAsset,
  listMyAssets,
  listAssetAssignments,
} from "../../controllers/hrmsAssetAssignmentController.js";

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.get("/", listAssets);
router.post("/", allowRoles("hrms", "hr"), createAsset);
router.put("/:id", allowRoles("hrms", "hr"), updateAsset);
router.patch("/:id/status", allowRoles("hrms", "hr"), setAssetStatus);

router.get("/assignments/mine", listMyAssets);
router.get("/assignments", allowRoles("hrms", "hr"), listAssetAssignments);
router.post("/assignments", allowRoles("hrms", "hr"), assignAsset);
router.patch("/assignments/:id/return", allowRoles("hrms", "hr"), returnAsset);

export default router;
