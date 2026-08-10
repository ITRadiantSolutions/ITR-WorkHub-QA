import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/ProjectRoleAssignment.js", () => ({
  default: { find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), findById: vi.fn(), findByIdAndDelete: vi.fn() },
}));
vi.mock("../models/User.js", () => ({ default: { findById: vi.fn() } }));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("../utils/notify.js", () => ({ notifyUsers: vi.fn() }));

import ProjectRoleAssignment from "../models/ProjectRoleAssignment.js";
import User from "../models/User.js";
import { writeAuditLog } from "../utils/activityLog.js";
import { notifyUsers } from "../utils/notify.js";
import { listProjectRoles, upsertProjectRole, deleteProjectRole } from "./hrmsProjectRoleController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

const hrUser = (id = oid()) => ({ _id: id, roles: { hrms: "hr" } });
const managerUser = (id = oid()) => ({ _id: id, roles: { hrms: "manager" } });
const employeeUser = (id = oid()) => ({ _id: id, roles: { hrms: "employee" } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listProjectRoles", () => {
  it("400s when neither userId nor projectId is given", async () => {
    const req = { query: {}, user: hrUser() };
    const res = mockRes();

    await listProjectRoles(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ProjectRoleAssignment.find).not.toHaveBeenCalled();
  });

  it("lists assignments for a given user", async () => {
    const populate1 = vi.fn().mockReturnThis();
    const sort = vi.fn().mockResolvedValue([{ role: "employee" }]);
    ProjectRoleAssignment.find.mockReturnValue({ populate: populate1, sort });
    populate1.mockReturnValue({ populate: populate1, sort });

    const userId = oid();
    const req = { query: { userId: userId.toString() }, user: hrUser() };
    const res = mockRes();

    await listProjectRoles(req, res);

    expect(ProjectRoleAssignment.find).toHaveBeenCalledWith({ user: userId.toString() });
    expect(res.json).toHaveBeenCalledWith([{ role: "employee" }]);
  });
});

describe("upsertProjectRole", () => {
  it("400s when a required field is missing", async () => {
    const req = { body: { userId: oid().toString(), projectId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await upsertProjectRole(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("400s on an invalid role value", async () => {
    const req = {
      body: { userId: oid().toString(), projectId: oid().toString(), role: "superadmin" },
      user: hrUser(),
    };
    const res = mockRes();

    await upsertProjectRole(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("lets HR assign a role for any user", async () => {
    const hr = hrUser();
    const userId = oid();
    const projectId = oid();
    ProjectRoleAssignment.findOne.mockResolvedValue(null);
    const populated = { _id: oid(), project: { name: "Apollo" }, user: userId, role: "manager" };
    const populate1 = vi.fn().mockReturnThis();
    ProjectRoleAssignment.findOneAndUpdate.mockReturnValue({ populate: populate1 });
    populate1.mockReturnValueOnce({ populate: vi.fn().mockResolvedValue(populated) });

    const req = { body: { userId: userId.toString(), projectId: projectId.toString(), role: "manager" }, user: hr };
    const res = mockRes();

    await upsertProjectRole(req, res);

    expect(ProjectRoleAssignment.findOneAndUpdate).toHaveBeenCalledWith(
      { project: projectId.toString(), user: userId.toString() },
      { $set: { role: "manager", assignedBy: hr._id } },
      { new: true, upsert: true },
    );
    expect(writeAuditLog).toHaveBeenCalled();
    expect(notifyUsers).toHaveBeenCalledWith([userId.toString()], expect.objectContaining({ type: "projectRoleAssigned" }));
    expect(res.json).toHaveBeenCalledWith(populated);
  });

  it("403s a manager assigning a role for someone who is not their direct report", async () => {
    const manager = managerUser();
    const targetId = oid();
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ managerId: oid() }) }); // different manager

    const req = {
      body: { userId: targetId.toString(), projectId: oid().toString(), role: "employee" },
      user: manager,
    };
    const res = mockRes();

    await upsertProjectRole(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(ProjectRoleAssignment.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("lets a manager assign a role for their own direct report", async () => {
    const manager = managerUser();
    const targetId = oid();
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ managerId: manager._id }) });
    ProjectRoleAssignment.findOne.mockResolvedValue(null);
    const populate1 = vi.fn().mockReturnThis();
    ProjectRoleAssignment.findOneAndUpdate.mockReturnValue({ populate: populate1 });
    populate1.mockReturnValueOnce({ populate: vi.fn().mockResolvedValue({ _id: oid(), project: {}, user: targetId, role: "employee" }) });

    const req = {
      body: { userId: targetId.toString(), projectId: oid().toString(), role: "employee" },
      user: manager,
    };
    const res = mockRes();

    await upsertProjectRole(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(ProjectRoleAssignment.findOneAndUpdate).toHaveBeenCalled();
  });

  it("403s a plain employee entirely", async () => {
    const req = {
      body: { userId: oid().toString(), projectId: oid().toString(), role: "employee" },
      user: employeeUser(),
    };
    const res = mockRes();

    await upsertProjectRole(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(User.findById).not.toHaveBeenCalled();
    expect(ProjectRoleAssignment.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("deleteProjectRole", () => {
  it("404s when the assignment doesn't exist", async () => {
    ProjectRoleAssignment.findById.mockResolvedValue(null);
    const req = { params: { id: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await deleteProjectRole(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403s a manager deleting an assignment for a non-direct-report", async () => {
    const manager = managerUser();
    ProjectRoleAssignment.findById.mockResolvedValue({ _id: oid(), user: oid(), role: "employee" });
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ managerId: oid() }) });

    const req = { params: { id: oid().toString() }, user: manager };
    const res = mockRes();

    await deleteProjectRole(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(ProjectRoleAssignment.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it("lets HR delete any assignment", async () => {
    const assignment = { _id: oid(), user: oid(), role: "employee", project: oid() };
    ProjectRoleAssignment.findById.mockResolvedValue(assignment);
    ProjectRoleAssignment.findByIdAndDelete.mockResolvedValue(assignment);

    const req = { params: { id: assignment._id.toString() }, user: hrUser() };
    const res = mockRes();

    await deleteProjectRole(req, res);

    expect(ProjectRoleAssignment.findByIdAndDelete).toHaveBeenCalledWith(assignment._id.toString());
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
