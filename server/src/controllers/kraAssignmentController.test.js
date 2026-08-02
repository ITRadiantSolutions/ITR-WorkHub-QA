import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/KraAssignment.js", () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    insertMany: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));
vi.mock("../models/UsersGroup.js", () => ({
  default: { findById: vi.fn() },
}));
vi.mock("../models/User.js", () => ({
  default: { findById: vi.fn() },
}));

import KraAssignment from "../models/KraAssignment.js";
import UsersGroup from "../models/UsersGroup.js";
import User from "../models/User.js";
import {
  listAssignments,
  getAssignment,
  assignToUser,
  assignToGroup,
  updateAssignment,
  deleteAssignment,
} from "./kraAssignmentController.js";

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

describe("listAssignments", () => {
  it("HR with no query filters sees everything (empty filter)", async () => {
    const populate = vi.fn().mockResolvedValue([]);
    KraAssignment.find.mockReturnValue({ populate });

    const req = { query: {}, user: hrUser() };
    const res = mockRes();

    await listAssignments(req, res);

    expect(KraAssignment.find).toHaveBeenCalledWith({});
    expect(populate).toHaveBeenCalledWith("assignedTo", "name email");
  });

  it("HR filtering by cycleId only adds cycleId to the filter, not assignedTo", async () => {
    const populate = vi.fn().mockResolvedValue([]);
    KraAssignment.find.mockReturnValue({ populate });
    const cycleId = "cycle-1";

    const req = { query: { cycleId }, user: hrUser() };
    const res = mockRes();

    await listAssignments(req, res);

    expect(KraAssignment.find).toHaveBeenCalledWith({ cycleId });
  });

  it("a non-HR caller with no userId query is restricted to their own assignments", async () => {
    const populate = vi.fn().mockResolvedValue([]);
    KraAssignment.find.mockReturnValue({ populate });
    const userId = oid();

    const req = { query: {}, user: employeeUser(userId) };
    const res = mockRes();

    await listAssignments(req, res);

    expect(KraAssignment.find).toHaveBeenCalledWith({ assignedTo: userId });
  });

  // Fixed IDOR (was: kraAssignmentController.js lines 12-19) — an employee's
  // explicit ?userId= query must never override their own self-restriction.
  it("an employee CANNOT override the self-restriction by passing an explicit userId", async () => {
    const populate = vi.fn().mockResolvedValue([]);
    KraAssignment.find.mockReturnValue({ populate });
    const callerId = oid();
    const someoneElseId = oid().toString();

    const req = { query: { userId: someoneElseId }, user: employeeUser(callerId) };
    const res = mockRes();

    await listAssignments(req, res);

    expect(KraAssignment.find).toHaveBeenCalledWith({ assignedTo: callerId });
  });

  it("a manager passing their own id as userId is allowed", async () => {
    const populate = vi.fn().mockResolvedValue([]);
    KraAssignment.find.mockReturnValue({ populate });
    const managerId = oid();

    const req = { query: { userId: managerId.toString() }, user: managerUser(managerId) };
    const res = mockRes();

    await listAssignments(req, res);

    expect(KraAssignment.find).toHaveBeenCalledWith({ assignedTo: managerId.toString() });
    expect(User.findById).not.toHaveBeenCalled();
  });

  it("a manager passing a direct report's id as userId is allowed", async () => {
    const populate = vi.fn().mockResolvedValue([]);
    KraAssignment.find.mockReturnValue({ populate });
    const managerId = oid();
    const reportId = oid().toString();
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ managerId }) });

    const req = { query: { userId: reportId }, user: managerUser(managerId) };
    const res = mockRes();

    await listAssignments(req, res);

    expect(KraAssignment.find).toHaveBeenCalledWith({ assignedTo: reportId });
  });

  it("403s a manager passing a stranger's id as userId (IDOR fixed)", async () => {
    const managerId = oid();
    const strangerId = oid().toString();
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ managerId: oid() }) });

    const req = { query: { userId: strangerId }, user: managerUser(managerId) };
    const res = mockRes();

    await listAssignments(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraAssignment.find).not.toHaveBeenCalled();
  });
});

describe("getAssignment", () => {
  it("404s when the assignment doesn't exist", async () => {
    const populate = vi.fn().mockResolvedValue(null);
    KraAssignment.findById.mockReturnValue({ populate });

    const req = { params: { id: oid() }, user: employeeUser() };
    const res = mockRes();

    await getAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Assignment not found" });
  });

  it("lets the assignee (self) view their own assignment", async () => {
    const userId = oid();
    const assignment = { _id: oid(), assignedTo: { _id: userId, managerId: null } };
    const populate = vi.fn().mockResolvedValue(assignment);
    KraAssignment.findById.mockReturnValue({ populate });

    const req = { params: { id: assignment._id }, user: employeeUser(userId) };
    const res = mockRes();

    await getAssignment(req, res);

    expect(res.json).toHaveBeenCalledWith(assignment);
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it("lets HR view any assignment", async () => {
    const assignment = { _id: oid(), assignedTo: { _id: oid(), managerId: null } };
    const populate = vi.fn().mockResolvedValue(assignment);
    KraAssignment.findById.mockReturnValue({ populate });

    const req = { params: { id: assignment._id }, user: hrUser() };
    const res = mockRes();

    await getAssignment(req, res);

    expect(res.json).toHaveBeenCalledWith(assignment);
  });

  it("lets a manager view an assignment belonging to their direct report", async () => {
    const managerId = oid();
    const assignment = { _id: oid(), assignedTo: { _id: oid(), managerId } };
    const populate = vi.fn().mockResolvedValue(assignment);
    KraAssignment.findById.mockReturnValue({ populate });

    const req = { params: { id: assignment._id }, user: managerUser(managerId) };
    const res = mockRes();

    await getAssignment(req, res);

    expect(res.json).toHaveBeenCalledWith(assignment);
  });

  it("403s a manager who is not the assignee's manager", async () => {
    const assignment = { _id: oid(), assignedTo: { _id: oid(), managerId: oid() } };
    const populate = vi.fn().mockResolvedValue(assignment);
    KraAssignment.findById.mockReturnValue({ populate });

    const req = { params: { id: assignment._id }, user: managerUser(oid()) };
    const res = mockRes();

    await getAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("403s an employee trying to view someone else's assignment", async () => {
    const assignment = { _id: oid(), assignedTo: { _id: oid(), managerId: null } };
    const populate = vi.fn().mockResolvedValue(assignment);
    KraAssignment.findById.mockReturnValue({ populate });

    const req = { params: { id: assignment._id }, user: employeeUser(oid()) };
    const res = mockRes();

    await getAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("assignToUser", () => {
  it("403s an employee caller", async () => {
    const req = { body: { cycleId: oid(), userId: oid() }, user: employeeUser() };
    const res = mockRes();

    await assignToUser(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraAssignment.create).not.toHaveBeenCalled();
  });

  // Fixed permission gate: assigning a KRA/KPI set is Manager or HR, matching
  // the reference doc (was HR-only).
  it("allows a manager caller to assign a KRA to a user", async () => {
    const cycleId = oid();
    const userId = oid();
    const created = { _id: oid(), assignedTo: userId };
    KraAssignment.create.mockResolvedValue(created);

    const req = { body: { cycleId, userId }, user: managerUser() };
    const res = mockRes();

    await assignToUser(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(KraAssignment.create).toHaveBeenCalled();
  });

  it("400s when cycleId or userId is missing", async () => {
    const req = { body: { cycleId: oid() }, user: hrUser() };
    const res = mockRes();

    await assignToUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(KraAssignment.create).not.toHaveBeenCalled();
  });

  it("creates a single assignment for the user as HR, defaulting templateId to null and kras to []", async () => {
    const hrId = oid();
    const cycleId = oid();
    const userId = oid();
    const created = { _id: oid(), assignedTo: userId };
    KraAssignment.create.mockResolvedValue(created);

    const req = { body: { cycleId, userId }, user: hrUser(hrId) };
    const res = mockRes();

    await assignToUser(req, res);

    expect(KraAssignment.create).toHaveBeenCalledWith({
      cycleId,
      templateId: null,
      assignedTo: userId,
      kras: [],
      createdBy: hrId,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
  });

  it("passes through templateId and kras when provided", async () => {
    const hrId = oid();
    const cycleId = oid();
    const templateId = oid();
    const userId = oid();
    const kras = [{ name: "Delivery", weight: 100, kpis: [] }];
    KraAssignment.create.mockResolvedValue({ _id: oid() });

    const req = { body: { cycleId, templateId, userId, kras }, user: hrUser(hrId) };
    const res = mockRes();

    await assignToUser(req, res);

    expect(KraAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({ templateId, kras, assignedTo: userId }),
    );
  });
});

describe("assignToGroup", () => {
  it("403s an employee caller", async () => {
    const req = { body: { cycleId: oid(), groupId: oid() }, user: employeeUser() };
    const res = mockRes();

    await assignToGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(UsersGroup.findById).not.toHaveBeenCalled();
  });

  it("allows a manager caller to assign a KRA to a group", async () => {
    UsersGroup.findById.mockResolvedValue({ members: [] });
    KraAssignment.insertMany.mockResolvedValue([]);
    const req = { body: { cycleId: oid(), groupId: oid() }, user: managerUser() };
    const res = mockRes();

    await assignToGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(UsersGroup.findById).toHaveBeenCalled();
  });

  it("400s when cycleId or groupId is missing", async () => {
    const req = { body: { cycleId: oid() }, user: hrUser() };
    const res = mockRes();

    await assignToGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(UsersGroup.findById).not.toHaveBeenCalled();
  });

  it("404s when the group doesn't exist", async () => {
    UsersGroup.findById.mockResolvedValue(null);
    const req = { body: { cycleId: oid(), groupId: oid() }, user: hrUser() };
    const res = mockRes();

    await assignToGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Group not found" });
    expect(KraAssignment.insertMany).not.toHaveBeenCalled();
  });

  // This is the group-expansion behavior called out in the task: assigning to
  // a 3-member group must produce one KraAssignment document per member.
  // The expansion logic does live in this file (assignToGroup, lines 54-72)
  // and uses insertMany with one entry per group.members id, each carrying
  // the same cycleId/templateId/kras/createdBy and its own assignedTo.
  //
  // Per-member NOTIFICATION is a separate claim (§07 of the doc: "emails
  // each assignee"). Neither this file nor usersGroupController.js imports
  // any mail/notify utility, and a repo-wide search found no such wiring in
  // legacyKraController.js either — so there is currently no notification
  // side effect to assert on for group (or single-user) assignment at all.
  // This diverges from the reference doc, which describes an email per
  // assignee ("New KRA & KPI Assigned").
  it("expands a 3-member group into 3 individual assignment documents via insertMany, one per member, with no notification wiring present", async () => {
    const hrId = oid();
    const cycleId = oid();
    const templateId = oid();
    const groupId = oid();
    const memberIds = [oid(), oid(), oid()];
    const group = { _id: groupId, name: "Frontend", members: memberIds };
    UsersGroup.findById.mockResolvedValue(group);

    const createdDocs = memberIds.map((id) => ({ _id: oid(), assignedTo: id }));
    KraAssignment.insertMany.mockResolvedValue(createdDocs);

    const kras = [{ name: "Code Quality", weight: 50, kpis: [] }];
    const req = { body: { cycleId, templateId, groupId, kras }, user: hrUser(hrId) };
    const res = mockRes();

    await assignToGroup(req, res);

    expect(UsersGroup.findById).toHaveBeenCalledWith(groupId);
    expect(KraAssignment.insertMany).toHaveBeenCalledTimes(1);

    const [insertedDocs] = KraAssignment.insertMany.mock.calls[0];
    expect(insertedDocs).toHaveLength(3);
    memberIds.forEach((memberId, i) => {
      expect(insertedDocs[i]).toEqual({
        cycleId,
        templateId,
        assignedTo: memberId,
        kras,
        createdBy: hrId,
      });
    });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(createdDocs);
  });

  it("defaults templateId to null and kras to [] for each expanded member document", async () => {
    const groupId = oid();
    const memberIds = [oid(), oid()];
    UsersGroup.findById.mockResolvedValue({ _id: groupId, members: memberIds });
    KraAssignment.insertMany.mockResolvedValue([]);

    const req = { body: { cycleId: oid(), groupId }, user: hrUser() };
    const res = mockRes();

    await assignToGroup(req, res);

    const [insertedDocs] = KraAssignment.insertMany.mock.calls[0];
    expect(insertedDocs).toHaveLength(2);
    insertedDocs.forEach((doc) => {
      expect(doc.templateId).toBeNull();
      expect(doc.kras).toEqual([]);
    });
  });

  it("creates zero documents for an empty group with no error", async () => {
    const groupId = oid();
    UsersGroup.findById.mockResolvedValue({ _id: groupId, members: [] });
    KraAssignment.insertMany.mockResolvedValue([]);

    const req = { body: { cycleId: oid(), groupId }, user: hrUser() };
    const res = mockRes();

    await assignToGroup(req, res);

    expect(KraAssignment.insertMany).toHaveBeenCalledWith([]);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith([]);
  });
});

describe("updateAssignment", () => {
  const buildAssignment = (overrides = {}) => ({
    _id: oid(),
    kras: [],
    status: "draft",
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  it("403s an employee caller", async () => {
    const req = { params: { id: oid() }, body: { status: "submitted" }, user: employeeUser() };
    const res = mockRes();

    await updateAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraAssignment.findById).not.toHaveBeenCalled();
  });

  it("allows a manager caller to update an assignment", async () => {
    const assignment = { kras: [], status: "draft", save: vi.fn().mockResolvedValue(undefined) };
    KraAssignment.findById.mockResolvedValue(assignment);
    const req = { params: { id: oid() }, body: { status: "submitted" }, user: managerUser() };
    const res = mockRes();

    await updateAssignment(req, res);

    expect(assignment.status).toBe("submitted");
    expect(assignment.save).toHaveBeenCalled();
  });

  it("404s when the assignment doesn't exist", async () => {
    KraAssignment.findById.mockResolvedValue(null);
    const req = { params: { id: oid() }, body: { status: "submitted" }, user: hrUser() };
    const res = mockRes();

    await updateAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updates only kras when status is omitted", async () => {
    const assignment = buildAssignment();
    KraAssignment.findById.mockResolvedValue(assignment);
    const newKras = [{ name: "Delivery", weight: 100, kpis: [] }];
    const hrId = oid();

    const req = { params: { id: assignment._id }, body: { kras: newKras }, user: hrUser(hrId) };
    const res = mockRes();

    await updateAssignment(req, res);

    expect(assignment.kras).toBe(newKras);
    expect(assignment.status).toBe("draft");
    expect(assignment.updatedBy).toBe(hrId);
    expect(assignment.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(assignment);
  });

  it("updates only status when kras is omitted", async () => {
    const assignment = buildAssignment({ kras: [{ name: "Existing" }] });
    KraAssignment.findById.mockResolvedValue(assignment);

    const req = { params: { id: assignment._id }, body: { status: "submitted" }, user: hrUser() };
    const res = mockRes();

    await updateAssignment(req, res);

    expect(assignment.status).toBe("submitted");
    expect(assignment.kras).toEqual([{ name: "Existing" }]);
    expect(assignment.save).toHaveBeenCalled();
  });

  it("updates both kras and status together", async () => {
    const assignment = buildAssignment();
    KraAssignment.findById.mockResolvedValue(assignment);
    const newKras = [{ name: "New" }];

    const req = { params: { id: assignment._id }, body: { kras: newKras, status: "submitted" }, user: hrUser() };
    const res = mockRes();

    await updateAssignment(req, res);

    expect(assignment.kras).toBe(newKras);
    expect(assignment.status).toBe("submitted");
  });
});

describe("deleteAssignment", () => {
  it("403s an employee caller", async () => {
    const req = { params: { id: oid() }, user: employeeUser() };
    const res = mockRes();

    await deleteAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraAssignment.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it("allows a manager caller to delete an assignment", async () => {
    KraAssignment.findByIdAndDelete.mockResolvedValue({ _id: oid() });
    const req = { params: { id: oid() }, user: managerUser() };
    const res = mockRes();

    await deleteAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("404s when the assignment doesn't exist", async () => {
    KraAssignment.findByIdAndDelete.mockResolvedValue(null);
    const req = { params: { id: oid() }, user: hrUser() };
    const res = mockRes();

    await deleteAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("deletes and returns 204 with no body", async () => {
    const assignment = { _id: oid() };
    KraAssignment.findByIdAndDelete.mockResolvedValue(assignment);
    const req = { params: { id: assignment._id }, user: hrUser() };
    const res = mockRes();

    await deleteAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
  });
});
