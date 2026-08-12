import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import { objectIdParam } from "../middleware/validateObjectId.js";
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
  setManageAccessGrant,
  setSuperAdmin,
  setManager,
  bulkAssignManager,
  setShift,
  syncUsersFromAzureGroups,
} from "../controllers/userController.js";
import { getAccessGrantAuditLogs } from "../controllers/activityLogController.js";

const router = Router();
router.use(protect);
router.param("id", objectIdParam);

router.get("/", listUsers);
router.post("/", createUser);
router.get("/me", getMe);
router.get("/my-reports", getMyReports);
router.get("/managers", listManagers);
router.get("/access-audit-logs", getAccessGrantAuditLogs);
router.put("/:id", updateUserGeneric);
router.delete("/:id", deleteUser);
router.patch("/:id/role", assignRole);
router.patch("/:id/archive", setArchived);
router.patch("/:id/manage-access-grant", setManageAccessGrant);
router.patch("/:id/super-admin", setSuperAdmin);
router.patch("/:id/manager", setManager);
router.patch("/:id/shift", setShift);
router.post("/bulk-assign-manager", bulkAssignManager);
router.post("/sync", syncUsersFromAzureGroups);

export default router;
