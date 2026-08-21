import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Announcement.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findById: vi.fn(), findByIdAndDelete: vi.fn() },
  ANNOUNCEMENT_CATEGORIES: ["company_news", "policy_update", "birthday", "general"],
}));
vi.mock("../config/blobStorage.js", () => ({ uploadAttachment: vi.fn(), createReadUrl: vi.fn(() => "https://signed.example/attachment") }));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));

import Announcement from "../models/Announcement.js";
import { uploadAttachment } from "../config/blobStorage.js";
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  acknowledgeAnnouncement,
  getAnnouncementAttachmentUrl,
} from "./hrmsAnnouncementController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  return res;
};

// .populate(...).populate(...).sort(...) — list path; .populate(...).populate(...)
// resolving directly — the re-fetch-and-populate path used after create/update/acknowledge.
const makeQuery = (result) => {
  const query = {};
  query.populate = vi.fn().mockReturnValue(query);
  query.sort = vi.fn().mockResolvedValue(result);
  query.then = (resolve) => resolve(result);
  return query;
};

const hrUser = () => ({ _id: oid(), roles: { hrms: "hr" } });
const employeeUser = () => ({ _id: oid(), roles: { hrms: "employee" } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listAnnouncements", () => {
  it("excludes expired announcements by default", async () => {
    Announcement.find.mockReturnValue(makeQuery([]));

    await listAnnouncements({ query: {}, user: hrUser() }, mockRes());

    expect(Announcement.find).toHaveBeenCalledWith({ $or: [{ expiresAt: null }, { expiresAt: { $gte: expect.any(Date) } }] });
  });

  it("includes expired announcements when asked", async () => {
    Announcement.find.mockReturnValue(makeQuery([]));

    await listAnnouncements({ query: { includeExpired: "true" }, user: hrUser() }, mockRes());

    expect(Announcement.find).toHaveBeenCalledWith({});
  });
});

describe("createAnnouncement", () => {
  it("400s when title is missing", async () => {
    const req = { body: {}, user: hrUser() };
    const res = mockRes();

    await createAnnouncement(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Announcement.create).not.toHaveBeenCalled();
  });

  it("400s an invalid category", async () => {
    const req = { body: { title: "Holiday notice", category: "gossip" }, user: hrUser() };
    const res = mockRes();

    await createAnnouncement(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("400s an unsupported attachment type", async () => {
    const req = { body: { title: "Holiday notice" }, file: { mimetype: "application/zip" }, user: hrUser() };
    const res = mockRes();

    await createAnnouncement(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Announcement.create).not.toHaveBeenCalled();
  });

  it("creates an announcement, anchoring a date-only expiresAt to end-of-day IST", async () => {
    const hr = hrUser();
    const created = { _id: oid(), title: "Holiday notice", acknowledgedBy: [], save: vi.fn() };
    Announcement.create.mockResolvedValue(created);
    Announcement.findById.mockReturnValue(makeQuery(created));

    const req = { body: { title: "Holiday notice", category: "company_news", expiresAt: "2026-08-25" }, user: hr };
    const res = mockRes();

    await createAnnouncement(req, res);

    expect(Announcement.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Holiday notice", createdBy: hr._id, expiresAt: new Date("2026-08-25T18:29:59.999Z") }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("uploads an attachment when a file is provided", async () => {
    const hr = hrUser();
    const created = { _id: oid(), title: "Policy update", acknowledgedBy: [], save: vi.fn() };
    Announcement.create.mockResolvedValue(created);
    Announcement.findById.mockReturnValue(makeQuery(created));
    uploadAttachment.mockResolvedValue({ blobName: "hrms-announcement-attachment/abc.pdf" });

    const req = {
      body: { title: "Policy update" },
      file: { buffer: Buffer.from("x"), originalname: "policy.pdf", mimetype: "application/pdf" },
      user: hr,
    };
    await createAnnouncement(req, mockRes());

    expect(uploadAttachment).toHaveBeenCalledWith(expect.objectContaining({ fileName: "policy.pdf", scope: "hrms-announcement-attachment" }));
    expect(created.attachmentBlobName).toBe("hrms-announcement-attachment/abc.pdf");
    expect(created.attachmentFileName).toBe("policy.pdf");
    expect(created.save).toHaveBeenCalled();
  });
});

describe("updateAnnouncement", () => {
  it("404s when not found", async () => {
    Announcement.findById.mockResolvedValueOnce(null);
    const req = { params: { id: oid().toString() }, body: { title: "x" }, user: hrUser() };
    const res = mockRes();

    await updateAnnouncement(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("anchors a date-only expiresAt update to end-of-day IST", async () => {
    const announcement = { _id: oid(), expiresAt: null, save: vi.fn() };
    Announcement.findById.mockResolvedValueOnce(announcement).mockReturnValueOnce(makeQuery(announcement));

    const req = { params: { id: announcement._id.toString() }, body: { expiresAt: "2026-08-25" }, user: hrUser() };
    await updateAnnouncement(req, mockRes());

    expect(announcement.expiresAt).toEqual(new Date("2026-08-25T18:29:59.999Z"));
    expect(announcement.save).toHaveBeenCalled();
  });

  it("clears expiresAt when set back to empty", async () => {
    const announcement = { _id: oid(), expiresAt: new Date("2026-08-25T18:29:59.999Z"), save: vi.fn() };
    Announcement.findById.mockResolvedValueOnce(announcement).mockReturnValueOnce(makeQuery(announcement));

    const req = { params: { id: announcement._id.toString() }, body: { expiresAt: "" }, user: hrUser() };
    await updateAnnouncement(req, mockRes());

    expect(announcement.expiresAt).toBeNull();
  });
});

describe("deleteAnnouncement", () => {
  it("404s when not found", async () => {
    Announcement.findByIdAndDelete.mockResolvedValue(null);
    const req = { params: { id: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await deleteAnnouncement(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("deletes and returns 204", async () => {
    Announcement.findByIdAndDelete.mockResolvedValue({ _id: oid(), title: "Old notice" });
    const req = { params: { id: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await deleteAnnouncement(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });
});

describe("acknowledgeAnnouncement", () => {
  it("404s when not found", async () => {
    Announcement.findById.mockResolvedValueOnce(null);
    const req = { params: { id: oid().toString() }, user: employeeUser() };
    const res = mockRes();

    await acknowledgeAnnouncement(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("records an acknowledgement", async () => {
    const employee = employeeUser();
    const announcement = { _id: oid(), acknowledgedBy: [], save: vi.fn() };
    Announcement.findById.mockResolvedValueOnce(announcement).mockReturnValueOnce(makeQuery(announcement));

    const req = { params: { id: announcement._id.toString() }, user: employee };
    await acknowledgeAnnouncement(req, mockRes());

    expect(announcement.acknowledgedBy).toEqual([expect.objectContaining({ user: employee._id })]);
    expect(announcement.save).toHaveBeenCalled();
  });

  it("is idempotent — a second acknowledgement from the same user doesn't duplicate", async () => {
    const employee = employeeUser();
    const announcement = { _id: oid(), acknowledgedBy: [{ user: employee._id, at: new Date() }], save: vi.fn() };
    Announcement.findById.mockResolvedValueOnce(announcement).mockReturnValueOnce(makeQuery(announcement));

    const req = { params: { id: announcement._id.toString() }, user: employee };
    await acknowledgeAnnouncement(req, mockRes());

    expect(announcement.acknowledgedBy).toHaveLength(1);
    expect(announcement.save).not.toHaveBeenCalled();
  });
});

describe("getAnnouncementAttachmentUrl", () => {
  it("404s when the announcement has no attachment", async () => {
    Announcement.findById.mockResolvedValue({ _id: oid(), attachmentBlobName: "" });
    const req = { params: { id: oid().toString() }, user: employeeUser() };
    const res = mockRes();

    await getAnnouncementAttachmentUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns a signed URL", async () => {
    Announcement.findById.mockResolvedValue({ _id: oid(), attachmentBlobName: "blob/x.pdf", attachmentFileName: "x.pdf" });
    const req = { params: { id: oid().toString() }, user: employeeUser() };
    const res = mockRes();

    await getAnnouncementAttachmentUrl(req, res);

    expect(res.json).toHaveBeenCalledWith({ url: "https://signed.example/attachment", fileName: "x.pdf" });
  });
});
