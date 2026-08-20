import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/SalaryStructure.js", () => ({
  default: { findOneAndUpdate: vi.fn(), findOne: vi.fn() },
}));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));

import SalaryStructure from "../models/SalaryStructure.js";
import { upsertSalaryStructure, getSalaryStructure } from "./hrmsSalaryStructureController.js";

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

describe("upsertSalaryStructure", () => {
  it("400s when employeeId is missing", async () => {
    const req = { body: { components: [{ name: "Basic", type: "earning", amount: 100 }] }, user: hrUser() };
    const res = mockRes();

    await upsertSalaryStructure(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(SalaryStructure.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("400s on an empty components array", async () => {
    const req = { body: { employeeId: oid().toString(), components: [] }, user: hrUser() };
    const res = mockRes();

    await upsertSalaryStructure(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("400s a component with an invalid type", async () => {
    const req = {
      body: { employeeId: oid().toString(), components: [{ name: "Basic", type: "bonus", amount: 100 }] },
      user: hrUser(),
    };
    const res = mockRes();

    await upsertSalaryStructure(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("upserts a valid structure", async () => {
    const employeeId = oid().toString();
    SalaryStructure.findOneAndUpdate.mockResolvedValue({ _id: oid(), employee: employeeId });

    const req = {
      body: { employeeId, components: [{ name: "Basic", type: "earning", amount: 50000 }, { name: "PF", type: "deduction", amount: 1800 }] },
      user: hrUser(),
    };
    const res = mockRes();

    await upsertSalaryStructure(req, res);

    expect(SalaryStructure.findOneAndUpdate).toHaveBeenCalledWith(
      { employee: employeeId },
      expect.objectContaining({ components: expect.arrayContaining([expect.objectContaining({ name: "Basic", amount: 50000 })]) }),
      expect.objectContaining({ upsert: true }),
    );
    expect(res.json).toHaveBeenCalled();
  });
});

describe("getSalaryStructure", () => {
  it("403s an employee viewing someone else's structure", async () => {
    const req = { params: { employeeId: oid().toString() }, user: { _id: oid(), roles: { hrms: "employee" } } };
    const res = mockRes();

    await getSalaryStructure(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(SalaryStructure.findOne).not.toHaveBeenCalled();
  });

  it("allows an employee to view their own structure", async () => {
    const employee = { _id: oid(), roles: { hrms: "employee" } };
    SalaryStructure.findOne.mockResolvedValue({ employee: employee._id, components: [] });

    const req = { params: { employeeId: employee._id.toString() }, user: employee };
    const res = mockRes();

    await getSalaryStructure(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it("404s when no structure exists", async () => {
    SalaryStructure.findOne.mockResolvedValue(null);
    const req = { params: { employeeId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await getSalaryStructure(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
