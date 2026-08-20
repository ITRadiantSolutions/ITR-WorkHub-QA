import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import {
  listLibrary,
  addLibraryKra,
  updateLibraryKra,
  removeLibraryKra,
  listMasterTemplates,
  getMasterTemplate,
  createMasterTemplate,
  updateMasterTemplate,
  deleteMasterTemplate,
} from "../../controllers/kraDefinitionController.js";
import {
  listAssignments,
  listAssignedUserIdsForCycle,
  getAssignment,
  assignToUser,
  assignToGroup,
  updateAssignment,
  deleteAssignment,
  addEmployeeKra,
  removeEmployeeKra,
  searchUsers,
  searchUserSuggestions,
  listPmsManagers,
} from "../../controllers/kraAssignmentController.js";

const router = Router();
router.use(protect, requireModuleAccess("pms"));

router.get("/library", listLibrary);
router.post("/library", addLibraryKra);
router.put("/library/:type/:kraId", updateLibraryKra);
router.delete("/library/:type/:kraId", removeLibraryKra);

router.get("/templates", listMasterTemplates);
router.post("/templates", createMasterTemplate);
router.get("/templates/:id", getMasterTemplate);
router.put("/templates/:id", updateMasterTemplate);
router.delete("/templates/:id", deleteMasterTemplate);

router.get("/users/search", searchUsers);
router.get("/users/search-suggestions", searchUserSuggestions);
router.get("/managers", listPmsManagers);

router.get("/assignments", listAssignments);
router.get("/assignments/assigned-user-ids", listAssignedUserIdsForCycle);
router.post("/assignments/user", assignToUser);
router.post("/assignments/group", assignToGroup);
router.get("/assignments/:id", getAssignment);
router.put("/assignments/:id", updateAssignment);
router.delete("/assignments/:id", deleteAssignment);
router.post("/assignments/:id/kras", addEmployeeKra);
router.delete("/assignments/:id/kras/:kraId", removeEmployeeKra);

export default router;
