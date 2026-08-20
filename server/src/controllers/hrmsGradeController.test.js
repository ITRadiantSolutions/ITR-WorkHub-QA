import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Grade.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findById: vi.fn() },
}));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));

import Grade from "../models/Grade.js";
import { listGrades, createGrade, updateGrade, setGradeStatus } from "./hrmsGradeController.js";

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

describe("listGrades", () => {
  it("defaults to active-only", async () => {
    const sort = vi.fn().mockResolvedValue([]);
    Grade.find.mockReturnValue({ sort });

    await listGrades({ query: {}, user: hrUser() }, mockRes());

    expect(Grade.find).toHaveBeenCalledWith({ isActive: true });
  });
});

describe("createGrade", () => {
  it("400s when name is missing", async () => {
    const req = { body: {}, user: hrUser() };
    const res = mockRes();

    await createGrade(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Grade.create).not.toHaveBeenCalled();
  });

  it("creates a grade with a salary band", async () => {
    const hr = hrUser();
    Grade.create.mockResolvedValue({ _id: oid(), name: "L3" });

    const req = { body: { name: "L3", level: 3, minSalary: 800000, maxSalary: 1200000 }, user: hr };
    const res = mockRes();

    await createGrade(req, res);

    expect(Grade.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "L3", minSalary: 800000, maxSalary: 1200000, createdBy: hr._id }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("409s on a duplicate name", async () => {
    const error = new Error("dup");
    error.code = 11000;
    Grade.create.mockRejectedValue(error);

    const req = { body: { name: "L3" }, user: hrUser() };
    const res = mockRes();

    await createGrade(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe("updateGrade", () => {
  it("404s when not found", async () => {
    Grade.findById.mockResolvedValue(null);
    const req = { params: { id: oid().toString() }, body: { name: "x" }, user: hrUser() };
    const res = mockRes();

    await updateGrade(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("setGradeStatus", () => {
  it("flips isActive", async () => {
    const grade = { _id: oid(), isActive: true, save: vi.fn().mockResolvedValue(undefined) };
    Grade.findById.mockResolvedValue(grade);

    const req = { params: { id: grade._id.toString() }, body: { isActive: false }, user: hrUser() };
    await setGradeStatus(req, mockRes());

    expect(grade.isActive).toBe(false);
  });
});
