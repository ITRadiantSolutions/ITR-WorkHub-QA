import { Router } from "express";
import { protect } from "../../middleware/authMiddleware.js";
import {
  listLibrary,
  addLibraryKra,
  removeLibraryKra,
  listMasterTemplates,
  getMasterTemplate,
  createMasterTemplate,
  updateMasterTemplate,
  deleteMasterTemplate,
} from "../../controllers/kraDefinitionController.js";
import {
  listAssignments,
  getAssignment,
  assignToUser,
  assignToGroup,
  updateAssignment,
  deleteAssignment,
} from "../../controllers/kraAssignmentController.js";

const router = Router();
router.use(protect);

router.get("/library", listLibrary);
router.post("/library", addLibraryKra);
router.delete("/library/:type/:kraId", removeLibraryKra);

router.get("/templates", listMasterTemplates);
router.post("/templates", createMasterTemplate);
router.get("/templates/:id", getMasterTemplate);
router.put("/templates/:id", updateMasterTemplate);
router.delete("/templates/:id", deleteMasterTemplate);

router.get("/assignments", listAssignments);
router.post("/assignments/user", assignToUser);
router.post("/assignments/group", assignToGroup);
router.get("/assignments/:id", getAssignment);
router.put("/assignments/:id", updateAssignment);
router.delete("/assignments/:id", deleteAssignment);

export default router;
