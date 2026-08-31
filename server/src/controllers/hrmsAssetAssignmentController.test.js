import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/AssetAssignment.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findById: vi.fn() },
}));
vi.mock("../models/Asset.js", () => ({
  default: { findById: vi.fn(), findOneAndUpdate: vi.fn() },
}));
vi.mock("../models/User.js", () => ({ default: { findById: vi.fn() } }));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("../utils/notify.js", () => ({ notifyUsers: vi.fn() }));
vi.mock("../utils/hrmsMailer.js", () => ({ sendHrmsEmail: vi.fn() }));

import AssetAssignment from "../models/AssetAssignment.js";
import Asset from "../models/Asset.js";
import User from "../models/User.js";
import { notifyUsers } from "../utils/notify.js";
import { sendHrmsEmail } from "../utils/hrmsMailer.js";
import { assignAsset, returnAsset, listMyAssets, listAssetAssignments } from "./hrmsAssetAssignmentController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const makeQuery = (result) => {
  const query = {};
  query.populate = vi.fn().mockReturnValue(query);
  query.sort = vi.fn().mockResolvedValue(result);
  query.then = (resolve) => resolve(result);
  return query;
};

const hrUser = () => ({ _id: oid(), roles: { hrms: "hr" } });
const makeSelectQuery = (result) => ({ select: vi.fn().mockResolvedValue(result) });

beforeEach(() => {
  vi.clearAllMocks();
  User.findById.mockReturnValue(makeSelectQuery({ name: "Eve Employee", email: "eve@example.com" }));
});

describe("assignAsset", () => {
  it("400s when assetId or employeeId is missing", async () => {
    const req = { body: { assetId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await assignAsset(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(AssetAssignment.create).not.toHaveBeenCalled();
  });

  it("404s an unknown employee", async () => {
    User.findById.mockReturnValue(makeSelectQuery(null));
    const req = { body: { assetId: oid().toString(), employeeId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await assignAsset(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(Asset.findOneAndUpdate).not.toHaveBeenCalled();
    expect(AssetAssignment.create).not.toHaveBeenCalled();
  });

  it("404s when the asset doesn't exist", async () => {
    Asset.findOneAndUpdate.mockResolvedValue(null);
    Asset.findById.mockReturnValue(makeSelectQuery(null));
    const req = { body: { assetId: oid().toString(), employeeId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await assignAsset(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(AssetAssignment.create).not.toHaveBeenCalled();
  });

  it("409s when the asset isn't available (atomically — the conditional update itself found no match)", async () => {
    Asset.findOneAndUpdate.mockResolvedValue(null);
    Asset.findById.mockReturnValue(makeSelectQuery({ status: "assigned" }));
    const req = { body: { assetId: oid().toString(), employeeId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await assignAsset(req, res);

    // The condition (_id + status:"available") is baked into the update
    // itself, not a separate read-then-write — this is what closes the race
    // where two near-simultaneous assignments could both see "available".
    expect(Asset.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: expect.any(String), status: "available" },
      { $set: { status: "assigned" } },
      { new: true },
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(AssetAssignment.create).not.toHaveBeenCalled();
  });

  it("assigns an available asset, notifies, and emails the employee", async () => {
    const asset = { _id: oid(), status: "assigned", name: "Dell XPS", assetTag: "A-1" };
    Asset.findOneAndUpdate.mockResolvedValue(asset);
    AssetAssignment.create.mockResolvedValue({ _id: oid() });
    AssetAssignment.findById.mockReturnValue(makeQuery({}));

    const employeeId = oid();
    const req = { body: { assetId: asset._id.toString(), employeeId: employeeId.toString() }, user: hrUser() };
    const res = mockRes();

    await assignAsset(req, res);

    expect(notifyUsers).toHaveBeenCalledWith([employeeId.toString()], expect.objectContaining({ type: "assetAssigned" }));
    expect(sendHrmsEmail).toHaveBeenCalledWith("eve@example.com", expect.any(String), expect.any(String), expect.any(String));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("returnAsset", () => {
  it("404s when the assignment doesn't exist", async () => {
    AssetAssignment.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(null) });
    const req = { params: { id: oid().toString() }, body: {}, user: hrUser() };
    const res = mockRes();

    await returnAsset(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("409s an already-returned assignment", async () => {
    AssetAssignment.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue({ _id: oid(), status: "returned" }) });
    const req = { params: { id: oid().toString() }, body: {}, user: hrUser() };
    const res = mockRes();

    await returnAsset(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("marks the assignment returned and frees the asset", async () => {
    const assetId = oid();
    const assignment = {
      _id: oid(), status: "active", asset: { _id: assetId, condition: "good" },
      save: vi.fn().mockResolvedValue(undefined),
    };
    const freedAsset = { _id: assetId, status: "assigned", condition: "good", save: vi.fn().mockResolvedValue(undefined) };

    AssetAssignment.findById
      .mockReturnValueOnce({ populate: vi.fn().mockResolvedValue(assignment) })
      .mockReturnValueOnce(makeQuery({}));
    Asset.findById.mockResolvedValue(freedAsset);

    const req = { params: { id: assignment._id.toString() }, body: { returnCondition: "fair", returnNotes: "minor scratch" }, user: hrUser() };
    await returnAsset(req, mockRes());

    expect(assignment.status).toBe("returned");
    expect(assignment.returnCondition).toBe("fair");
    expect(freedAsset.status).toBe("available");
    expect(freedAsset.condition).toBe("fair");
  });
});

describe("listMyAssets", () => {
  it("scopes to active assignments for the caller", async () => {
    const user = { _id: oid(), roles: { hrms: "employee" } };
    AssetAssignment.find.mockReturnValue(makeQuery([]));

    await listMyAssets({ user }, mockRes());

    expect(AssetAssignment.find).toHaveBeenCalledWith({ employee: user._id, status: "active" });
  });
});

describe("listAssetAssignments", () => {
  it("filters by employee/status when given", async () => {
    AssetAssignment.find.mockReturnValue(makeQuery([]));
    const employeeId = oid().toString();

    await listAssetAssignments({ query: { employee: employeeId, status: "active" }, user: hrUser() }, mockRes());

    expect(AssetAssignment.find).toHaveBeenCalledWith({ employee: employeeId, status: "active" });
  });
});
