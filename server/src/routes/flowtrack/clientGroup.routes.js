import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import { objectIdParam } from "../../middleware/validateObjectId.js";
import {
  listClientGroups,
  getClientGroup,
  createClientGroup,
  updateClientGroup,
  deleteClientGroup,
} from "../../controllers/clientGroupController.js";

const router = Router();
router.use(protect, requireModuleAccess("tracker"), allowRoles("tracker", "ADMIN"));
router.param("id", objectIdParam);

router.get("/", listClientGroups);
router.post("/", createClientGroup);
router.get("/:id", getClientGroup);
router.put("/:id", updateClientGroup);
router.delete("/:id", deleteClientGroup);

export default router;
