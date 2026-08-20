import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Location.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findById: vi.fn() },
}));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));

import Location from "../models/Location.js";
import { listLocations, createLocation, updateLocation, setLocationStatus } from "./hrmsLocationController.js";

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

describe("listLocations", () => {
  it("defaults to active-only", async () => {
    const sort = vi.fn().mockResolvedValue([]);
    Location.find.mockReturnValue({ sort });

    await listLocations({ query: {}, user: hrUser() }, mockRes());

    expect(Location.find).toHaveBeenCalledWith({ isActive: true });
  });
});

describe("createLocation", () => {
  it("400s when name is missing", async () => {
    const req = { body: {}, user: hrUser() };
    const res = mockRes();

    await createLocation(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Location.create).not.toHaveBeenCalled();
  });

  it("creates a location", async () => {
    const hr = hrUser();
    Location.create.mockResolvedValue({ _id: oid(), name: "Hyderabad HQ" });

    const req = { body: { name: "Hyderabad HQ", city: "Hyderabad", country: "India", isHeadOffice: true }, user: hr };
    const res = mockRes();

    await createLocation(req, res);

    expect(Location.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Hyderabad HQ", isHeadOffice: true, createdBy: hr._id }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("409s on a duplicate name", async () => {
    const error = new Error("dup");
    error.code = 11000;
    Location.create.mockRejectedValue(error);

    const req = { body: { name: "Hyderabad HQ" }, user: hrUser() };
    const res = mockRes();

    await createLocation(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe("updateLocation", () => {
  it("404s when not found", async () => {
    Location.findById.mockResolvedValue(null);
    const req = { params: { id: oid().toString() }, body: { name: "x" }, user: hrUser() };
    const res = mockRes();

    await updateLocation(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("setLocationStatus", () => {
  it("flips isActive", async () => {
    const location = { _id: oid(), isActive: true, save: vi.fn().mockResolvedValue(undefined) };
    Location.findById.mockResolvedValue(location);

    const req = { params: { id: location._id.toString() }, body: { isActive: false }, user: hrUser() };
    await setLocationStatus(req, mockRes());

    expect(location.isActive).toBe(false);
  });
});
