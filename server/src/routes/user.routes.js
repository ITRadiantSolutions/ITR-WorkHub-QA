import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  listUsers,
  getMe,
  createUser,
  updateUserGeneric,
  deleteUser,
  getMyReports,
  listManagers,
  assignRole,
  setArchived,
  setManager,
  bulkAssignManager,
  setShift,
} from "../controllers/userController.js";

const router = Router();
router.use(protect);

router.get("/", listUsers);
router.post("/", createUser);
router.get("/me", getMe);
router.get("/my-reports", getMyReports);
router.get("/managers", listManagers);
router.put("/:id", updateUserGeneric);
router.delete("/:id", deleteUser);
router.patch("/:id/role", assignRole);
router.patch("/:id/archive", setArchived);
router.patch("/:id/manager", setManager);
router.patch("/:id/shift", setShift);
router.post("/bulk-assign-manager", bulkAssignManager);

export default router;
