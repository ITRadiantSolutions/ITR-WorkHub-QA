import { Router } from "express";
import multer from "multer";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { allowRoles } from "../../middleware/roleMiddleware.js";
import { uploadDocument, listDocuments, getDocumentUrl, deleteDocument } from "../../controllers/hrmsDocumentController.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.use(protect, requireModuleAccess("hrms"));

router.post("/", allowRoles("hrms", "hr"), upload.single("file"), uploadDocument);
router.get("/employee/:employeeId", listDocuments);
router.get("/:id/url", getDocumentUrl);
router.delete("/:id", allowRoles("hrms", "hr"), deleteDocument);

export default router;
