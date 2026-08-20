import EmployeeDocument, { DOCUMENT_CATEGORIES } from "../models/EmployeeDocument.js";
import { uploadAttachment, createReadUrl, deleteAttachments } from "../config/blobStorage.js";
import { writeAuditLog } from "../utils/activityLog.js";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const canAccess = (doc, user) => user.roles.hrms === "hr" || doc.employee.toString() === user._id.toString();

export const uploadDocument = async (req, res) => {
  const { employeeId, title, category } = req.body;
  if (!employeeId) return res.status(400).json({ message: "employeeId is required" });
  if (!title?.trim()) return res.status(400).json({ message: "title is required" });
  if (category && !DOCUMENT_CATEGORIES.includes(category)) {
    return res.status(400).json({ message: `category must be one of: ${DOCUMENT_CATEGORIES.join(", ")}` });
  }
  if (!req.file) return res.status(400).json({ message: "A file is required" });
  if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
    return res.status(400).json({ message: `Unsupported file type: ${req.file.mimetype}` });
  }

  const uploaded = await uploadAttachment({
    buffer: req.file.buffer,
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    scope: "hrms-employee-document",
    parentId: employeeId,
  });

  const doc = await EmployeeDocument.create({
    employee: employeeId,
    title: title.trim(),
    category: category || "other",
    blobName: uploaded.blobName,
    fileName: req.file.originalname,
    uploadedBy: req.user._id,
  });

  writeAuditLog({
    type: "database", event: "hrms.document.uploaded", action: "hrms.document.uploaded",
    actorId: req.user._id, targetId: doc._id, oldValue: null, newValue: { employee: employeeId, title: doc.title },
  });
  res.status(201).json(doc);
};

export const listDocuments = async (req, res) => {
  const { employeeId } = req.params;
  if (req.user.roles.hrms !== "hr" && req.user._id.toString() !== employeeId) {
    return res.status(403).json({ message: "Forbidden" });
  }
  const documents = await EmployeeDocument.find({ employee: employeeId })
    .populate("uploadedBy", "name")
    .sort({ createdAt: -1 });
  res.json(documents);
};

export const getDocumentUrl = async (req, res) => {
  const doc = await EmployeeDocument.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Document not found" });
  if (!canAccess(doc, req.user)) return res.status(403).json({ message: "Forbidden" });
  res.json({ url: createReadUrl(doc.blobName) });
};

export const deleteDocument = async (req, res) => {
  const doc = await EmployeeDocument.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ message: "Document not found" });
  await deleteAttachments([doc.blobName]);

  writeAuditLog({
    type: "database", event: "hrms.document.deleted", action: "hrms.document.deleted",
    actorId: req.user._id, targetId: doc._id, oldValue: { title: doc.title }, newValue: null,
  });
  res.status(204).end();
};
