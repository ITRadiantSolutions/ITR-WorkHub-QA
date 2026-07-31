import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { objectIdParam } from "../middleware/validateObjectId.js";
import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  changeTaskStatus,
  addTaskComment,
  deleteTask,
  getTaskSummary,
  searchTasksGlobal,
  qaAssignTester,
  getQaTasks,
} from "../controllers/taskController.js";
import { exportTasksExcel, importTasks } from "../controllers/taskImportExport.js";

const router = Router();
router.use(protect);
router.param("id", objectIdParam);

router.get("/", listTasks);
router.post("/", allowRoles("tracker", "ADMIN", "PM", "DEVELOPER", "QA"), createTask);

// Literal routes registered before "/:id" so they aren't swallowed by it.
router.get("/summary", getTaskSummary);
router.get("/search/global", searchTasksGlobal);
router.get("/export", allowRoles("tracker", "ADMIN", "PM"), exportTasksExcel);
router.get("/qa", allowRoles("tracker", "QA"), getQaTasks);
router.post("/import", allowRoles("tracker", "ADMIN", "PM"), importTasks);

router.get("/:id", getTask);
router.put("/:id", updateTask);
router.patch("/:id/status", changeTaskStatus);
router.post("/:id/qa-assign", allowRoles("tracker", "ADMIN", "PM", "DEVELOPER"), qaAssignTester);
router.post("/:id/comments", addTaskComment);
router.delete("/:id", deleteTask);

export default router;
