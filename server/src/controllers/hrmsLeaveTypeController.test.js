import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/LeaveType.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findById: vi.fn() },
}));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));

import LeaveType from "../models/LeaveType.js";
import { listLeaveTypes, createLeaveType, updateLeaveType, setLeaveTypeStatus } from "./hrmsLeaveTypeController.js";

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

describe("listLeaveTypes", () => {
  it("defaults to active-only", async () => {
    const sort = vi.fn().mockResolvedValue([]);
    LeaveType.find.mockReturnValue({ sort });

    await listLeaveTypes({ query: {}, user: hrUser() }, mockRes());

    expect(LeaveType.find).toHaveBeenCalledWith({ isActive: true });
  });
});

describe("createLeaveType", () => {
  it("400s when name is missing", async () => {
    const req = { body: {}, user: hrUser() };
    const res = mockRes();

    await createLeaveType(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(LeaveType.create).not.toHaveBeenCalled();
  });

  it("creates a leave type", async () => {
    const hr = hrUser();
    LeaveType.create.mockResolvedValue({ _id: oid(), name: "Casual" });

    const req = { body: { name: "Casual", defaultDaysPerYear: 12 }, user: hr };
    const res = mockRes();

    await createLeaveType(req, res);

    expect(LeaveType.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Casual", defaultDaysPerYear: 12, createdBy: hr._id }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("409s on a duplicate name", async () => {
    const error = new Error("dup");
    error.code = 11000;
    LeaveType.create.mockRejectedValue(error);

    const req = { body: { name: "Casual" }, user: hrUser() };
    const res = mockRes();

    await createLeaveType(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe("updateLeaveType", () => {
  it("404s when not found", async () => {
    LeaveType.findById.mockResolvedValue(null);
    const req = { params: { id: oid().toString() }, body: { name: "x" }, user: hrUser() };
    const res = mockRes();

    await updateLeaveType(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("setLeaveTypeStatus", () => {
  it("flips isActive", async () => {
    const leaveType = { _id: oid(), isActive: true, save: vi.fn().mockResolvedValue(undefined) };
    LeaveType.findById.mockResolvedValue(leaveType);

    const req = { params: { id: leaveType._id.toString() }, body: { isActive: false }, user: hrUser() };
    await setLeaveTypeStatus(req, mockRes());

    expect(leaveType.isActive).toBe(false);
  });
});
