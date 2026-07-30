import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import { listKraLibrary, createKraLibraryEntries, updateKraLibraryEntry, deleteKraLibraryEntry } from "../controllers/legacyKraController.js";

const router = Router();
router.use(protect);

router.get("/", listKraLibrary);
router.post("/", createKraLibraryEntries);
router.put("/:kraId", updateKraLibraryEntry);
router.delete("/:kraId", deleteKraLibraryEntry);

export default router;
