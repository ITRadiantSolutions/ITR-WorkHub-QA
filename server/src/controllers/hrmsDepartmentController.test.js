import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Department.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findById: vi.fn(), insertMany: vi.fn() },
}));
vi.mock("../models/User.js", () => ({ default: { distinct: vi.fn() } }));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));

import Department from "../models/Department.js";
import User from "../models/User.js";
import {
  listDepartments,
  createDepartment,
  updateDepartment,
  setDepartmentStatus,
  importDepartmentsFromUsers,
} from "./hrmsDepartmentController.js";

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

describe("listDepartments", () => {
  it("defaults to active-only", async () => {
    const sort = vi.fn().mockResolvedValue([]);
    const populate = vi.fn().mockReturnValue({ sort });
    Department.find.mockReturnValue({ populate });

    const req = { query: {}, user: hrUser() };
    await listDepartments(req, mockRes());

    expect(Department.find).toHaveBeenCalledWith({ isActive: true });
  });

  it("includes inactive when asked", async () => {
    const sort = vi.fn().mockResolvedValue([]);
    const populate = vi.fn().mockReturnValue({ sort });
    Department.find.mockReturnValue({ populate });

    const req = { query: { includeInactive: "true" }, user: hrUser() };
    await listDepartments(req, mockRes());

    expect(Department.find).toHaveBeenCalledWith({});
  });
});

describe("createDepartment", () => {
  it("400s when name is missing", async () => {
    const req = { body: {}, user: hrUser() };
    const res = mockRes();

    await createDepartment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Department.create).not.toHaveBeenCalled();
  });

  it("creates a department", async () => {
    const hr = hrUser();
    const created = { _id: oid(), name: "Engineering" };
    Department.create.mockResolvedValue(created);

    const req = { body: { name: "Engineering" }, user: hr };
    const res = mockRes();

    await createDepartment(req, res);

    expect(Department.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Engineering", createdBy: hr._id }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("409s on a duplicate name", async () => {
    const error = new Error("dup");
    error.code = 11000;
    Department.create.mockRejectedValue(error);

    const req = { body: { name: "Engineering" }, user: hrUser() };
    const res = mockRes();

    await createDepartment(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe("updateDepartment", () => {
  it("404s when not found", async () => {
    Department.findById.mockResolvedValue(null);
    const req = { params: { id: oid().toString() }, body: { name: "x" }, user: hrUser() };
    const res = mockRes();

    await updateDepartment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updates the given fields", async () => {
    const department = { _id: oid(), name: "Old", save: vi.fn().mockResolvedValue(undefined) };
    Department.findById.mockResolvedValue(department);

    const req = { params: { id: department._id.toString() }, body: { name: "New" }, user: hrUser() };
    const res = mockRes();

    await updateDepartment(req, res);

    expect(department.name).toBe("New");
    expect(res.json).toHaveBeenCalledWith(department);
  });
});

describe("importDepartmentsFromUsers", () => {
  it("creates a department for each distinct, non-empty User.department not already present", async () => {
    User.distinct.mockResolvedValue(["Engineering", "  Sales  ", "", null, "Engineering"]);
    Department.find.mockReturnValue({ select: vi.fn().mockResolvedValue([{ name: "Engineering" }]) });
    Department.insertMany.mockResolvedValue([{ name: "Sales" }]);

    const req = { user: hrUser() };
    const res = mockRes();

    await importDepartmentsFromUsers(req, res);

    expect(Department.insertMany).toHaveBeenCalledWith(
      [expect.objectContaining({ name: "Sales" })],
      { ordered: false },
    );
    expect(res.json).toHaveBeenCalledWith({ imported: 1, names: ["Sales"] });
  });

  it("does nothing when every distinct value already has a department", async () => {
    User.distinct.mockResolvedValue(["Engineering"]);
    Department.find.mockReturnValue({ select: vi.fn().mockResolvedValue([{ name: "Engineering" }]) });

    const res = mockRes();
    await importDepartmentsFromUsers({ user: hrUser() }, res);

    expect(Department.insertMany).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ imported: 0, names: [] });
  });
});

describe("setDepartmentStatus", () => {
  it("404s when not found", async () => {
    Department.findById.mockResolvedValue(null);
    const req = { params: { id: oid().toString() }, body: { isActive: false }, user: hrUser() };
    const res = mockRes();

    await setDepartmentStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("flips isActive", async () => {
    const department = { _id: oid(), isActive: true, save: vi.fn().mockResolvedValue(undefined) };
    Department.findById.mockResolvedValue(department);

    const req = { params: { id: department._id.toString() }, body: { isActive: false }, user: hrUser() };
    const res = mockRes();

    await setDepartmentStatus(req, res);

    expect(department.isActive).toBe(false);
  });
});
