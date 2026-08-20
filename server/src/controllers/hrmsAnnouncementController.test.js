import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Announcement.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findById: vi.fn(), findByIdAndDelete: vi.fn() },
  ANNOUNCEMENT_CATEGORIES: ["company_news", "policy_update", "birthday", "general"],
}));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));

import Announcement from "../models/Announcement.js";
import { listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from "./hrmsAnnouncementController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  return res;
};

const hrUser = () => ({ _id: oid(), roles: { hrms: "hr" } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listAnnouncements", () => {
  it("excludes expired announcements by default", async () => {
    const sort = vi.fn().mockResolvedValue([]);
    const populate = vi.fn().mockReturnValue({ sort });
    Announcement.find.mockReturnValue({ populate });

    await listAnnouncements({ query: {}, user: hrUser() }, mockRes());

    expect(Announcement.find).toHaveBeenCalledWith({ $or: [{ expiresAt: null }, { expiresAt: { $gte: expect.any(Date) } }] });
  });

  it("includes expired announcements when asked", async () => {
    const sort = vi.fn().mockResolvedValue([]);
    const populate = vi.fn().mockReturnValue({ sort });
    Announcement.find.mockReturnValue({ populate });

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

  it("creates an announcement", async () => {
    const hr = hrUser();
    Announcement.create.mockResolvedValue({ _id: oid(), title: "Holiday notice" });

    const req = { body: { title: "Holiday notice", category: "company_news" }, user: hr };
    const res = mockRes();

    await createAnnouncement(req, res);

    expect(Announcement.create).toHaveBeenCalledWith(expect.objectContaining({ title: "Holiday notice", createdBy: hr._id }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("updateAnnouncement", () => {
  it("404s when not found", async () => {
    Announcement.findById.mockResolvedValue(null);
    const req = { params: { id: oid().toString() }, body: { title: "x" }, user: hrUser() };
    const res = mockRes();

    await updateAnnouncement(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
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
