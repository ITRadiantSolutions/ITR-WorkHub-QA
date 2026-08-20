import { Router } from "express";
import multer from "multer";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import {
  listPips,
  getPip,
  createPip,
  updatePip,
  employeeSubmitPip,
  deletePip,
  getProofUrl,
  getPipEmployeeManager,
} from "../../controllers/pipController.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();
router.use(protect, requireModuleAccess("pms"));

router.get("/proof-url", getProofUrl);
router.get("/employee/:employeeId/manager", getPipEmployeeManager);
router.get("/", listPips);
router.post("/", createPip);
router.get("/:id", getPip);
router.put("/:id", updatePip);
router.post("/:id/employee-submit", upload.any(), employeeSubmitPip);
router.delete("/:id", deletePip);

export default router;
