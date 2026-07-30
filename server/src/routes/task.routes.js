import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
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

router.get("/", listTasks);
router.post("/", createTask);

// Literal routes registered before "/:id" so they aren't swallowed by it.
router.get("/summary", getTaskSummary);
router.get("/search/global", searchTasksGlobal);
router.get("/export", exportTasksExcel);
router.get("/qa", getQaTasks);
router.post("/import", importTasks);

router.get("/:id", getTask);
router.put("/:id", updateTask);
router.patch("/:id/status", changeTaskStatus);
router.post("/:id/qa-assign", qaAssignTester);
router.post("/:id/comments", addTaskComment);
router.delete("/:id", deleteTask);

export default router;
