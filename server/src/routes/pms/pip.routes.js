import { Router } from "express";
import { protect } from "../../middleware/authMiddleware.js";
import {
  listPips,
  getPip,
  createPip,
  updatePip,
  employeeSubmitPip,
  deletePip,
} from "../../controllers/pipController.js";

const router = Router();
router.use(protect);

router.get("/", listPips);
router.post("/", createPip);
router.get("/:id", getPip);
router.put("/:id", updatePip);
router.post("/:id/employee-submit", employeeSubmitPip);
router.delete("/:id", deletePip);

export default router;
