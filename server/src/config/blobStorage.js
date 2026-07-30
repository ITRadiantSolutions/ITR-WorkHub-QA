import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
  SASProtocol,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { writeAuditLog } from "../utils/activityLog.js";

let containerPromise;

const getCredential = () => {
  const accountName = process.env.STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.STORAGE_ACCOUNT_KEY;
  if (!accountName || !accountKey) {
    throw new Error("STORAGE_ACCOUNT_NAME and STORAGE_ACCOUNT_KEY are required");
  }
  return new StorageSharedKeyCredential(accountName, accountKey);
};

const getBlobServiceClient = () => {
  if (process.env.STORAGE_CONNECTION_STRING) {
    return BlobServiceClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING);
  }
  const accountName = process.env.STORAGE_ACCOUNT_NAME;
  return new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, getCredential());
};

const getContainerName = () => {
  const name = process.env.STORAGE_CONTAINER_NAME;
  if (!name) throw new Error("STORAGE_CONTAINER_NAME is required");
  return name;
};

export const getAttachmentContainer = async () => {
  if (!containerPromise) {
    containerPromise = (async () => {
      const container = getBlobServiceClient().getContainerClient(getContainerName());
      await container.createIfNotExists();
      return container;
    })().catch((error) => {
      containerPromise = undefined;
      throw error;
    });
  }
  return containerPromise;
};

const safeFileName = (fileName = "attachment") =>
  String(fileName)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-120) || "attachment";

export const createReadUrl = (blobName, expiresInMinutes = 60) => {
  if (!blobName) return null;
  const accountName = process.env.STORAGE_ACCOUNT_NAME;
  const startsOn = new Date(Date.now() - 5 * 60 * 1000);
  const expiresOn = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  const sas = generateBlobSASQueryParameters(
    {
      containerName: getContainerName(),
      blobName,
      permissions: BlobSASPermissions.parse("r"),
      protocol: SASProtocol.Https,
      startsOn,
      expiresOn,
    },
    getCredential(),
  ).toString();
  return `https://${accountName}.blob.core.windows.net/${getContainerName()}/${blobName}?${sas}`;
};

export const uploadAttachment = async ({ buffer, fileName, mimeType, scope, parentId }) => {
  try {
    const container = await getAttachmentContainer();
    const blobName = `${scope}/${parentId}/${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeFileName(fileName)}`;
    const blob = container.getBlockBlobClient(blobName);
    await blob.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: mimeType || "application/octet-stream",
        blobContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        blobCacheControl: "private, max-age=3600",
      },
    });
    writeAuditLog({ type: "cloud", provider: "azure_blob_storage", event: "attachment_uploaded", scope, parentId, blobName });
    return { blobName, url: createReadUrl(blobName) };
  } catch (error) {
    writeAuditLog({ level: "error", type: "cloud", provider: "azure_blob_storage", event: "attachment_upload_failed", scope, parentId, fileName, error: { message: error.message } });
    throw error;
  }
};

export const deleteAttachments = async (blobNames = []) => {
  if (!blobNames.length) return;
  const container = await getAttachmentContainer();
  await Promise.allSettled(blobNames.map((blobName) => container.deleteBlob(blobName, { deleteSnapshots: "include" })));
};
