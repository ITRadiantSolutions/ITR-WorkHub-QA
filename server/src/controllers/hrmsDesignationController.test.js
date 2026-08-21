import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Designation.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findById: vi.fn(), insertMany: vi.fn() },
}));
vi.mock("../models/User.js", () => ({ default: { distinct: vi.fn() } }));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));

import Designation from "../models/Designation.js";
import User from "../models/User.js";
import {
  listDesignations,
  createDesignation,
  updateDesignation,
  setDesignationStatus,
  importDesignationsFromUsers,
} from "./hrmsDesignationController.js";

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

describe("listDesignations", () => {
  it("defaults to active-only and can filter by department", async () => {
    const sort = vi.fn().mockResolvedValue([]);
    const populate = vi.fn().mockReturnValue({ sort });
    Designation.find.mockReturnValue({ populate });

    const deptId = oid().toString();
    const req = { query: { department: deptId }, user: hrUser() };
    await listDesignations(req, mockRes());

    expect(Designation.find).toHaveBeenCalledWith({ isActive: true, department: deptId });
  });
});

describe("createDesignation", () => {
  it("400s when name is missing", async () => {
    const req = { body: {}, user: hrUser() };
    const res = mockRes();

    await createDesignation(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Designation.create).not.toHaveBeenCalled();
  });

  it("creates a designation", async () => {
    const hr = hrUser();
    Designation.create.mockResolvedValue({ _id: oid(), name: "Senior Engineer" });

    const req = { body: { name: "Senior Engineer", level: 3 }, user: hr };
    const res = mockRes();

    await createDesignation(req, res);

    expect(Designation.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Senior Engineer", level: 3, createdBy: hr._id }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("409s on a duplicate name", async () => {
    const error = new Error("dup");
    error.code = 11000;
    Designation.create.mockRejectedValue(error);

    const req = { body: { name: "Senior Engineer" }, user: hrUser() };
    const res = mockRes();

    await createDesignation(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe("updateDesignation", () => {
  it("404s when not found", async () => {
    Designation.findById.mockResolvedValue(null);
    const req = { params: { id: oid().toString() }, body: { name: "x" }, user: hrUser() };
    const res = mockRes();

    await updateDesignation(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("importDesignationsFromUsers", () => {
  it("creates a designation for each distinct, non-empty User.designation not already present", async () => {
    User.distinct.mockResolvedValue(["Software Engineer", "", null, "Software Engineer", "QA Lead"]);
    Designation.find.mockReturnValue({ select: vi.fn().mockResolvedValue([{ name: "QA Lead" }]) });
    Designation.insertMany.mockResolvedValue([{ name: "Software Engineer" }]);

    const res = mockRes();
    await importDesignationsFromUsers({ user: hrUser() }, res);

    expect(Designation.insertMany).toHaveBeenCalledWith(
      [expect.objectContaining({ name: "Software Engineer" })],
      { ordered: false },
    );
    expect(res.json).toHaveBeenCalledWith({ imported: 1, names: ["Software Engineer"] });
  });

  it("does nothing when there are no distinct designation values", async () => {
    User.distinct.mockResolvedValue([]);
    Designation.find.mockReturnValue({ select: vi.fn().mockResolvedValue([]) });

    const res = mockRes();
    await importDesignationsFromUsers({ user: hrUser() }, res);

    expect(Designation.insertMany).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ imported: 0, names: [] });
  });
});

describe("setDesignationStatus", () => {
  it("flips isActive", async () => {
    const designation = { _id: oid(), isActive: true, save: vi.fn().mockResolvedValue(undefined) };
    Designation.findById.mockResolvedValue(designation);

    const req = { params: { id: designation._id.toString() }, body: { isActive: false }, user: hrUser() };
    await setDesignationStatus(req, mockRes());

    expect(designation.isActive).toBe(false);
  });
});
