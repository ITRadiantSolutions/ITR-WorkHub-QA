import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  listClientGroups,
  getClientGroup,
  createClientGroup,
  updateClientGroup,
  deleteClientGroup,
} from "../controllers/clientGroupController.js";

const router = Router();
router.use(protect);

router.get("/", listClientGroups);
router.post("/", createClientGroup);
router.get("/:id", getClientGroup);
router.put("/:id", updateClientGroup);
router.delete("/:id", deleteClientGroup);

export default router;
