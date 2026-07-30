import Project from "../models/Project.js";
import { uploadAttachment, deleteAttachments } from "../config/blobStorage.js";
import { writeAuditLog } from "../utils/activityLog.js";

const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "pdf", "doc", "docx", "xls", "xlsx"]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const uploadProjectAttachments = async (req, res) => {
  const uploadedBlobNames = [];
  const { id: projectId } = req.params;
  const files = Array.isArray(req.body.files) ? req.body.files : [];
  if (!files.length) return res.status(400).json({ message: "No files uploaded" });

  const project = await Project.findById(projectId);
  if (!project) return res.status(404).json({ message: "Project not found" });

  const prepared = [];
  const invalid = [];
  for (const file of files) {
    const extension = String(file.fileName || "").split(".").pop().toLowerCase();
    const buffer = Buffer.from(file.contentBase64 || "", "base64");
    if (!ALLOWED_EXTENSIONS.has(extension)) invalid.push({ file: file.fileName, reason: "Invalid extension" });
    else if (!buffer.length || buffer.length > MAX_FILE_SIZE_BYTES) invalid.push({ file: file.fileName, reason: "Invalid file size" });
    else prepared.push({ ...file, buffer });
  }
  if (invalid.length) return res.status(400).json({ message: "One or more files are not allowed", invalid });

  try {
    const attachments = [];
    for (const file of prepared) {
      const uploaded = await uploadAttachment({ buffer: file.buffer, fileName: file.fileName, mimeType: file.mimeType, scope: "projects", parentId: projectId });
      uploadedBlobNames.push(uploaded.blobName);
      attachments.push({
        fileName: file.fileName,
        storedName: uploaded.blobName,
        blobName: uploaded.blobName,
        fileMime: file.mimeType,
        fileSize: file.buffer.length,
        fileUrl: uploaded.url,
        uploadedBy: req.user._id,
        uploadedAt: new Date(),
      });
    }

    project.attachments = [...(project.attachments || []), ...attachments];
    await project.save();
    res.json({ message: "Attachments uploaded successfully", project, attachments });
  } catch (error) {
    await deleteAttachments(uploadedBlobNames).catch(() => {});
    writeAuditLog({ level: "error", type: "cloud", provider: "azure_blob_storage", event: "attachment_upload_failed", projectId, error: { message: error.message } });
    res.status(500).json({ message: "Failed to upload attachments to Blob Storage" });
  }
};
