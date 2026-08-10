import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/UsersGroup.js", () => ({
  default: { find: vi.fn(), findById: vi.fn(), create: vi.fn(), findByIdAndDelete: vi.fn() },
}));

import UsersGroup from "../models/UsersGroup.js";
import { listGroups, getGroup, createGroup, updateGroup, deleteGroup } from "./usersGroupController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

const hrUser = (id = oid()) => ({ _id: id, roles: { pms: "hr" } });
const managerUser = (id = oid()) => ({ _id: id, roles: { pms: "manager" } });
const employeeUser = (id = oid()) => ({ _id: id, roles: { pms: "employee" } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listGroups", () => {
  it("returns all groups with members populated, for any authenticated role", async () => {
    const groups = [{ name: "Frontend" }, { name: "QA" }];
    const populate = vi.fn().mockResolvedValue(groups);
    UsersGroup.find.mockReturnValue({ populate });

    const req = { user: employeeUser() };
    const res = mockRes();

    await listGroups(req, res);

    expect(UsersGroup.find).toHaveBeenCalledWith({});
    expect(populate).toHaveBeenCalledWith("members", "name email");
    expect(res.json).toHaveBeenCalledWith(groups);
  });
});

describe("getGroup", () => {
  it("404s when the group doesn't exist", async () => {
    const populate = vi.fn().mockResolvedValue(null);
    UsersGroup.findById.mockReturnValue({ populate });

    const req = { params: { id: oid() }, user: employeeUser() };
    const res = mockRes();

    await getGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Group not found" });
  });

  it("returns the group for any authenticated user (no HR/manager gate)", async () => {
    const group = { _id: oid(), name: "Backend" };
    const populate = vi.fn().mockResolvedValue(group);
    UsersGroup.findById.mockReturnValue({ populate });

    const req = { params: { id: group._id }, user: employeeUser() };
    const res = mockRes();

    await getGroup(req, res);

    expect(res.json).toHaveBeenCalledWith(group);
  });
});

describe("createGroup", () => {
  it("403s an employee caller", async () => {
    const req = { body: { name: "New Group" }, user: employeeUser() };
    const res = mockRes();

    await createGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "PMS Manager or HR access required" });
    expect(UsersGroup.create).not.toHaveBeenCalled();
  });

  // Fixed permission gate: group creation is Manager or HR, matching the
  // reference doc (was HR-only).
  it("allows a manager caller to create a group", async () => {
    const managerId = oid();
    const created = { _id: oid(), name: "New Group" };
    UsersGroup.create.mockResolvedValue(created);

    const req = { body: { name: "New Group" }, user: managerUser(managerId) };
    const res = mockRes();

    await createGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(UsersGroup.create).toHaveBeenCalled();
  });

  it("400s when name is missing", async () => {
    const req = { body: { description: "no name" }, user: hrUser() };
    const res = mockRes();

    await createGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(UsersGroup.create).not.toHaveBeenCalled();
  });

  it("creates a group as HR with name/description/members defaulting members to []", async () => {
    const hrId = oid();
    const created = { _id: oid(), name: "Frontend" };
    UsersGroup.create.mockResolvedValue(created);

    const req = { body: { name: "Frontend", description: "FE team" }, user: hrUser(hrId) };
    const res = mockRes();

    await createGroup(req, res);

    expect(UsersGroup.create).toHaveBeenCalledWith({
      name: "Frontend",
      description: "FE team",
      members: [],
      createdBy: hrId,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
  });

  it("creates a group with explicit members when provided", async () => {
    const hrId = oid();
    const memberIds = [oid(), oid(), oid()];
    const created = { _id: oid(), name: "QA", members: memberIds };
    UsersGroup.find.mockReturnValue({ populate: vi.fn().mockResolvedValue([]) });
    UsersGroup.create.mockResolvedValue(created);

    const req = { body: { name: "QA", members: memberIds }, user: hrUser(hrId) };
    const res = mockRes();

    await createGroup(req, res);

    expect(UsersGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "QA", members: memberIds, createdBy: hrId }),
    );
  });

  it("400s and does not create when a member already belongs to another group", async () => {
    const hrId = oid();
    const takenMember = oid();
    const populate = vi.fn().mockResolvedValue([
      { _id: oid(), members: [{ _id: takenMember, name: "Ann" }] },
    ]);
    UsersGroup.find.mockReturnValue({ populate });

    const req = { body: { name: "QA", members: [takenMember] }, user: hrUser(hrId) };
    const res = mockRes();

    await createGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Already in another group: Ann" });
    expect(UsersGroup.create).not.toHaveBeenCalled();
  });
});

describe("updateGroup", () => {
  const buildGroup = (overrides = {}) => ({
    _id: oid(),
    name: "Old name",
    description: "Old description",
    members: [],
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  it("403s an employee caller", async () => {
    const req = { params: { id: oid() }, body: { name: "New" }, user: employeeUser() };
    const res = mockRes();

    await updateGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(UsersGroup.findById).not.toHaveBeenCalled();
  });

  it("allows a manager caller to update a group", async () => {
    const group = buildGroup();
    UsersGroup.findById.mockResolvedValue(group);
    const req = { params: { id: group._id }, body: { name: "New" }, user: managerUser() };
    const res = mockRes();

    await updateGroup(req, res);

    expect(group.name).toBe("New");
    expect(group.save).toHaveBeenCalled();
  });

  it("404s when the group doesn't exist", async () => {
    UsersGroup.findById.mockResolvedValue(null);
    const req = { params: { id: oid() }, body: { name: "New" }, user: hrUser() };
    const res = mockRes();

    await updateGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updates only the fields provided, leaving others untouched", async () => {
    const group = buildGroup();
    UsersGroup.findById.mockResolvedValue(group);
    const req = { params: { id: group._id }, body: { name: "New name" }, user: hrUser() };
    const res = mockRes();

    await updateGroup(req, res);

    expect(group.name).toBe("New name");
    expect(group.description).toBe("Old description");
    expect(group.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(group);
  });

  it("replaces members wholesale when members is provided", async () => {
    const group = buildGroup({ members: [oid()] });
    UsersGroup.findById.mockResolvedValue(group);
    UsersGroup.find.mockReturnValue({ populate: vi.fn().mockResolvedValue([]) });
    const newMembers = [oid(), oid()];
    const req = { params: { id: group._id }, body: { members: newMembers }, user: hrUser() };
    const res = mockRes();

    await updateGroup(req, res);

    expect(group.members).toBe(newMembers);
    expect(group.save).toHaveBeenCalled();
  });

  it("excludes the group being edited from the conflict check (its own current members don't block re-saving)", async () => {
    const group = buildGroup({ members: [oid()] });
    UsersGroup.findById.mockResolvedValue(group);
    const populate = vi.fn().mockResolvedValue([]);
    UsersGroup.find.mockReturnValue({ populate });
    const req = { params: { id: group._id }, body: { members: [oid()] }, user: hrUser() };
    const res = mockRes();

    await updateGroup(req, res);

    expect(UsersGroup.find).toHaveBeenCalledWith(
      expect.objectContaining({ _id: { $ne: group._id } }),
    );
    expect(group.save).toHaveBeenCalled();
  });

  it("400s and does not save when a member already belongs to a different group", async () => {
    const group = buildGroup();
    UsersGroup.findById.mockResolvedValue(group);
    const takenMember = oid();
    const populate = vi.fn().mockResolvedValue([
      { _id: oid(), members: [{ _id: takenMember, name: "Ben" }] },
    ]);
    UsersGroup.find.mockReturnValue({ populate });

    const req = { params: { id: group._id }, body: { members: [takenMember] }, user: hrUser() };
    const res = mockRes();

    await updateGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Already in another group: Ben" });
    expect(group.save).not.toHaveBeenCalled();
  });
});

describe("deleteGroup", () => {
  it("403s an employee caller", async () => {
    const req = { params: { id: oid() }, user: employeeUser() };
    const res = mockRes();

    await deleteGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(UsersGroup.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it("allows a manager caller to delete a group", async () => {
    UsersGroup.findByIdAndDelete.mockResolvedValue({ _id: oid() });
    const req = { params: { id: oid() }, user: managerUser() };
    const res = mockRes();

    await deleteGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("404s when the group doesn't exist", async () => {
    UsersGroup.findByIdAndDelete.mockResolvedValue(null);
    const req = { params: { id: oid() }, user: hrUser() };
    const res = mockRes();

    await deleteGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("deletes and returns 204 with no body", async () => {
    const group = { _id: oid() };
    UsersGroup.findByIdAndDelete.mockResolvedValue(group);
    const req = { params: { id: group._id }, user: hrUser() };
    const res = mockRes();

    await deleteGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
  });
});
