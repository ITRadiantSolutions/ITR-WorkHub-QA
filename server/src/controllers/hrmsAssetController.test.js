import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Asset.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findById: vi.fn() },
  ASSET_CATEGORIES: ["laptop", "monitor", "mobile", "sim", "keyboard", "mouse", "other"],
}));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));

import Asset from "../models/Asset.js";
import { listAssets, createAsset, updateAsset, setAssetStatus } from "./hrmsAssetController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const hrUser = () => ({ _id: oid(), roles: { hrms: "hr" } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listAssets", () => {
  it("filters by status/category when given", async () => {
    const sort = vi.fn().mockResolvedValue([]);
    Asset.find.mockReturnValue({ sort });

    await listAssets({ query: { status: "available", category: "laptop" }, user: hrUser() }, mockRes());

    expect(Asset.find).toHaveBeenCalledWith({ status: "available", category: "laptop" });
  });
});

describe("createAsset", () => {
  it("400s an invalid category", async () => {
    const req = { body: { assetTag: "A-1", name: "Dell XPS", category: "spaceship" }, user: hrUser() };
    const res = mockRes();

    await createAsset(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Asset.create).not.toHaveBeenCalled();
  });

  it("creates an asset", async () => {
    const hr = hrUser();
    Asset.create.mockResolvedValue({ _id: oid(), assetTag: "A-1" });

    const req = { body: { assetTag: "A-1", name: "Dell XPS", category: "laptop" }, user: hr };
    const res = mockRes();

    await createAsset(req, res);

    expect(Asset.create).toHaveBeenCalledWith(expect.objectContaining({ assetTag: "A-1", createdBy: hr._id }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("409s on a duplicate assetTag", async () => {
    const error = new Error("dup");
    error.code = 11000;
    Asset.create.mockRejectedValue(error);

    const req = { body: { assetTag: "A-1", name: "Dell XPS", category: "laptop" }, user: hrUser() };
    const res = mockRes();

    await createAsset(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe("updateAsset", () => {
  it("404s when not found", async () => {
    Asset.findById.mockResolvedValue(null);
    const req = { params: { id: oid().toString() }, body: { name: "x" }, user: hrUser() };
    const res = mockRes();

    await updateAsset(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("setAssetStatus", () => {
  it("409s changing status while assigned", async () => {
    Asset.findById.mockResolvedValue({ _id: oid(), status: "assigned" });
    const req = { params: { id: oid().toString() }, body: { status: "retired" }, user: hrUser() };
    const res = mockRes();

    await setAssetStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("400s an invalid status value", async () => {
    Asset.findById.mockResolvedValue({ _id: oid(), status: "available" });
    const req = { params: { id: oid().toString() }, body: { status: "assigned" }, user: hrUser() };
    const res = mockRes();

    await setAssetStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retires an available asset", async () => {
    const asset = { _id: oid(), status: "available", save: vi.fn().mockResolvedValue(undefined) };
    Asset.findById.mockResolvedValue(asset);

    const req = { params: { id: asset._id.toString() }, body: { status: "retired" }, user: hrUser() };
    await setAssetStatus(req, mockRes());

    expect(asset.status).toBe("retired");
  });
});
