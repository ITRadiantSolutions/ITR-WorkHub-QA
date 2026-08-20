import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/EmployeeDocument.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findById: vi.fn(), findByIdAndDelete: vi.fn() },
  DOCUMENT_CATEGORIES: ["offer_letter", "id_proof", "education_certificate", "experience_letter", "policy_acknowledgement", "other"],
}));
vi.mock("../config/blobStorage.js", () => ({
  uploadAttachment: vi.fn(),
  createReadUrl: vi.fn(() => "https://signed.example/doc"),
  deleteAttachments: vi.fn(),
}));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));

import EmployeeDocument from "../models/EmployeeDocument.js";
import { uploadAttachment, deleteAttachments } from "../config/blobStorage.js";
import { uploadDocument, listDocuments, getDocumentUrl, deleteDocument } from "./hrmsDocumentController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  return res;
};

const hrUser = () => ({ _id: oid(), roles: { hrms: "hr" } });
const employeeUser = () => ({ _id: oid(), roles: { hrms: "employee" } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("uploadDocument", () => {
  it("400s when employeeId is missing", async () => {
    const req = { body: { title: "Offer letter" }, file: { mimetype: "application/pdf" }, user: hrUser() };
    const res = mockRes();

    await uploadDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("400s when there's no file", async () => {
    const req = { body: { employeeId: oid().toString(), title: "Offer letter" }, file: null, user: hrUser() };
    const res = mockRes();

    await uploadDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(uploadAttachment).not.toHaveBeenCalled();
  });

  it("400s an unsupported mime type", async () => {
    const req = {
      body: { employeeId: oid().toString(), title: "Offer letter" },
      file: { mimetype: "application/zip" },
      user: hrUser(),
    };
    const res = mockRes();

    await uploadDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("uploads and creates a document record", async () => {
    uploadAttachment.mockResolvedValue({ blobName: "hrms-employee-document/abc" });
    EmployeeDocument.create.mockResolvedValue({ _id: oid() });

    const hr = hrUser();
    const employeeId = oid();
    const req = {
      body: { employeeId: employeeId.toString(), title: "Offer letter", category: "offer_letter" },
      file: { mimetype: "application/pdf", buffer: Buffer.from("x"), originalname: "offer.pdf" },
      user: hr,
    };
    const res = mockRes();

    await uploadDocument(req, res);

    expect(EmployeeDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({ employee: employeeId.toString(), title: "Offer letter", uploadedBy: hr._id }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("listDocuments", () => {
  it("403s an employee viewing someone else's documents", async () => {
    const req = { params: { employeeId: oid().toString() }, user: employeeUser() };
    const res = mockRes();

    await listDocuments(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(EmployeeDocument.find).not.toHaveBeenCalled();
  });

  it("allows an employee to list their own documents", async () => {
    const employee = employeeUser();
    const sort = vi.fn().mockResolvedValue([]);
    const populate = vi.fn().mockReturnValue({ sort });
    EmployeeDocument.find.mockReturnValue({ populate });

    const req = { params: { employeeId: employee._id.toString() }, user: employee };
    const res = mockRes();

    await listDocuments(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
  });
});

describe("getDocumentUrl", () => {
  it("404s when not found", async () => {
    EmployeeDocument.findById.mockResolvedValue(null);
    const req = { params: { id: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await getDocumentUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403s someone who isn't the owner or HR", async () => {
    EmployeeDocument.findById.mockResolvedValue({ _id: oid(), employee: oid(), blobName: "x" });
    const req = { params: { id: oid().toString() }, user: employeeUser() };
    const res = mockRes();

    await getDocumentUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns a signed url for the owner", async () => {
    const employee = employeeUser();
    EmployeeDocument.findById.mockResolvedValue({ _id: oid(), employee: employee._id, blobName: "x" });
    const req = { params: { id: oid().toString() }, user: employee };
    const res = mockRes();

    await getDocumentUrl(req, res);

    expect(res.json).toHaveBeenCalledWith({ url: "https://signed.example/doc" });
  });
});

describe("deleteDocument", () => {
  it("404s when not found", async () => {
    EmployeeDocument.findByIdAndDelete.mockResolvedValue(null);
    const req = { params: { id: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await deleteDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("deletes the blob and the record", async () => {
    EmployeeDocument.findByIdAndDelete.mockResolvedValue({ _id: oid(), blobName: "x", title: "Offer letter" });
    const req = { params: { id: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await deleteDocument(req, res);

    expect(deleteAttachments).toHaveBeenCalledWith(["x"]);
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
