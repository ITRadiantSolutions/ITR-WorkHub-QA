import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/KraDefinition.js", () => ({
  default: { find: vi.fn(), create: vi.fn(), findOne: vi.fn(), findOneAndDelete: vi.fn() },
}));
vi.mock("../models/KraAssignment.js", () => ({
  default: { find: vi.fn(), insertMany: vi.fn(), findOne: vi.fn() },
}));
vi.mock("../models/User.js", () => ({ default: { find: vi.fn() } }));

import KraDefinition from "../models/KraDefinition.js";
import KraAssignment from "../models/KraAssignment.js";
import User from "../models/User.js";
import {
  listMasterTemplates,
  createMasterTemplate,
  updateMasterTemplate,
  deleteMasterTemplate,
  listUnassignedAssignees,
  submitKpiTemplateAssignment,
  updateKpiTemplateAssignment,
  updateKpiTemplateForUser,
  getAssignmentByAssignee,
} from "./legacyKraMasterTemplateController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

const hrUser = () => ({ _id: oid(), roles: { pms: "hr" } });
const managerUser = () => ({ _id: oid(), roles: { pms: "manager" } });
const employeeUser = () => ({ _id: oid(), roles: { pms: "employee" } });

// KraAssignment.find({templateId}).distinct("assignedTo") is used by
// serializeMasterTemplate — stub it to resolve to an empty list unless a
// test cares about it specifically.
const stubAssignedUsersLookup = (result = []) => {
  KraAssignment.find.mockReturnValue({ distinct: vi.fn().mockResolvedValue(result) });
};

beforeEach(() => {
  vi.clearAllMocks();
  stubAssignedUsersLookup([]);
});

describe("listMasterTemplates", () => {
  it("serializes each template into functional/organizational buckets plus assignedUsers", async () => {
    const templateId = oid();
    const kraFunctional = { _id: oid(), name: "Delivery", type: "functional", weight: 40, kpis: [{ title: "Ship on time", weight: 100 }] };
    const kraOrg = { _id: oid(), name: "Culture", type: "organizational", weight: 60, kpis: [{ name: "Mentoring", weight: 100 }] };
    KraDefinition.find.mockResolvedValue([{ _id: templateId, name: "Eng Template", kras: [kraFunctional, kraOrg] }]);
    const assignedUser = oid();
    stubAssignedUsersLookup([assignedUser]);
    const res = mockRes();

    await listMasterTemplates({}, res);

    expect(KraDefinition.find).toHaveBeenCalledWith({ scope: "master_template" });
    expect(res.json).toHaveBeenCalledWith([
      {
        id: templateId.toString(),
        name: "Eng Template",
        functionalKras: [
          { id: kraFunctional._id.toString(), name: "Delivery", type: "functional", weight: 40, kpis: [{ name: "Ship on time", title: "Ship on time", weight: 100 }] },
        ],
        organizationalKras: [
          { id: kraOrg._id.toString(), name: "Culture", type: "organizational", weight: 60, kpis: [{ name: "Mentoring", title: "Mentoring", weight: 100 }] },
        ],
        assignedUsers: [assignedUser],
      },
    ]);
  });
});

describe("createMasterTemplate", () => {
  it("403s a plain employee", async () => {
    const req = { user: employeeUser(), body: { name: "x" } };
    const res = mockRes();

    await createMasterTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraDefinition.create).not.toHaveBeenCalled();
  });

  // Building the master template catalog is HR-curated content — only HR
  // may create it (unlike assigning it to people, which is Manager+HR).
  it("403s a pms manager caller (master template build is HR-only)", async () => {
    const req = { user: managerUser(), body: { name: "x" } };
    const res = mockRes();

    await createMasterTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraDefinition.create).not.toHaveBeenCalled();
  });

  it("400s when name is missing", async () => {
    const req = { user: hrUser(), body: {} };
    const res = mockRes();

    await createMasterTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(KraDefinition.create).not.toHaveBeenCalled();
  });

  it("builds kras from raw functionalKras/organizationalKras with no library linkage", async () => {
    const user = hrUser();
    const createdDoc = { _id: oid(), name: "Eng Template", kras: [] };
    KraDefinition.create.mockResolvedValue(createdDoc);
    const req = {
      user,
      body: {
        name: "Eng Template",
        functionalKras: [{ name: "Delivery", weight: 40, kpis: [{ name: "Ship on time", weight: 100 }] }],
        organizationalKras: [{ name: "Culture", weight: 60, kpis: [{ title: "Mentoring", weight: 100 }] }],
      },
    };
    const res = mockRes();

    await createMasterTemplate(req, res);

    expect(KraDefinition.create).toHaveBeenCalledWith({
      scope: "master_template",
      name: "Eng Template",
      kras: [
        { name: "Delivery", type: "functional", weight: 40, kpis: [{ title: "Ship on time", weight: 100 }] },
        { name: "Culture", type: "organizational", weight: 60, kpis: [{ title: "Mentoring", weight: 100 }] },
      ],
      createdBy: user._id,
    });
    // No originalId is ever attached — unlike kraDefinitionController's
    // library-backed templates, entries built here have no link back to a
    // kra_library entry (diverges from the §05 data-model doc).
    expect(KraDefinition.create.mock.calls[0][0].kras[0].originalId).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("updateMasterTemplate", () => {
  it("403s a plain employee", async () => {
    const req = { user: employeeUser(), params: { id: oid() }, body: {} };
    const res = mockRes();

    await updateMasterTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraDefinition.findOne).not.toHaveBeenCalled();
  });

  it("403s a pms manager caller (master template edit is HR-only)", async () => {
    const req = { user: managerUser(), params: { id: oid() }, body: { name: "New" } };
    const res = mockRes();

    await updateMasterTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraDefinition.findOne).not.toHaveBeenCalled();
  });

  it("404s when the template doesn't exist", async () => {
    KraDefinition.findOne.mockResolvedValue(null);
    const req = { user: hrUser(), params: { id: oid() }, body: { name: "New" } };
    const res = mockRes();

    await updateMasterTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updates only the name and leaves kras untouched when kra lists are omitted", async () => {
    const existingKras = [{ _id: oid(), name: "Delivery", type: "functional", weight: 40, kpis: [] }];
    const doc = { _id: oid(), name: "Old name", kras: existingKras, save: vi.fn().mockResolvedValue(undefined) };
    KraDefinition.findOne.mockResolvedValue(doc);
    const req = { user: hrUser(), params: { id: doc._id }, body: { name: "New name" } };
    const res = mockRes();

    await updateMasterTemplate(req, res);

    expect(doc.name).toBe("New name");
    expect(doc.kras).toBe(existingKras);
    expect(doc.save).toHaveBeenCalled();
  });

  it("replaces kras wholesale when functionalKras/organizationalKras are provided", async () => {
    const doc = {
      _id: oid(),
      name: "Old name",
      kras: [{ _id: oid(), name: "Stale" }],
      // Real Mongoose auto-assigns _id to new subdocuments (schema has
      // `_id: true`) once .save() runs — fake that so the post-save
      // serializeMasterTemplate() call (which needs k._id) doesn't blow up.
      save: vi.fn().mockImplementation(async function () {
        doc.kras.forEach((k) => {
          if (!k._id) k._id = oid();
        });
      }),
    };
    KraDefinition.findOne.mockResolvedValue(doc);
    const req = {
      user: hrUser(),
      params: { id: doc._id },
      body: { functionalKras: [{ name: "Fresh", weight: 100, kpis: [] }], organizationalKras: [] },
    };
    const res = mockRes();

    await updateMasterTemplate(req, res);

    expect(doc.kras).toEqual([{ _id: expect.anything(), name: "Fresh", type: "functional", weight: 100, kpis: [] }]);
    expect(doc.save).toHaveBeenCalled();
  });
});

describe("deleteMasterTemplate", () => {
  it("403s a plain employee", async () => {
    const req = { user: employeeUser(), params: { id: oid() } };
    const res = mockRes();

    await deleteMasterTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraDefinition.findOneAndDelete).not.toHaveBeenCalled();
  });

  it("403s a pms manager caller (master template delete is HR-only)", async () => {
    const req = { user: managerUser(), params: { id: oid() } };
    const res = mockRes();

    await deleteMasterTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraDefinition.findOneAndDelete).not.toHaveBeenCalled();
  });

  it("404s when the template doesn't exist", async () => {
    KraDefinition.findOneAndDelete.mockResolvedValue(null);
    const req = { user: hrUser(), params: { id: oid() } };
    const res = mockRes();

    await deleteMasterTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("deletes and responds 204", async () => {
    const id = oid();
    KraDefinition.findOneAndDelete.mockResolvedValue({ _id: id });
    const req = { user: hrUser(), params: { id } };
    const res = mockRes();

    await deleteMasterTemplate(req, res);

    expect(KraDefinition.findOneAndDelete).toHaveBeenCalledWith({ _id: id, scope: "master_template" });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
});

describe("listUnassignedAssignees", () => {
  it("403s a plain employee caller (fixed: was ungated)", async () => {
    const req = { user: employeeUser() };
    const res = mockRes();

    await listUnassignedAssignees(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(User.find).not.toHaveBeenCalled();
  });

  it("allows a manager or HR caller to list active users", async () => {
    const users = [{ _id: oid(), name: "Ann", roles: { pms: "employee" } }];
    User.find.mockReturnValue({ select: vi.fn().mockResolvedValue(users) });
    const req = { user: managerUser() };
    const res = mockRes();

    await listUnassignedAssignees(req, res);

    expect(User.find).toHaveBeenCalledWith({ "archived.pms": false });
    expect(res.json).toHaveBeenCalledWith([{ id: users[0]._id, name: "Ann", type: "user" }]);
  });
});

describe("submitKpiTemplateAssignment", () => {
  it("403s a plain employee", async () => {
    const req = { user: employeeUser(), body: { assignees: [{ id: oid() }] } };
    const res = mockRes();

    await submitKpiTemplateAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraAssignment.insertMany).not.toHaveBeenCalled();
  });

  it("400s when assignees is missing or empty", async () => {
    const req = { user: hrUser(), body: { assignees: [] } };
    const res = mockRes();

    await submitKpiTemplateAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(KraAssignment.insertMany).not.toHaveBeenCalled();
  });

  it("creates one draft assignment per assignee with normalized kras", async () => {
    const hr = hrUser();
    const assigneeA = oid();
    const assigneeB = oid();
    const templateId = oid();
    const created = [{ _id: oid() }, { _id: oid() }];
    KraAssignment.insertMany.mockResolvedValue(created);
    const req = {
      user: hr,
      body: {
        templateId,
        assignees: [{ id: assigneeA }, { id: assigneeB }],
        kras: [{ name: "Delivery", type: "functional", weight: "40", kpis: [{ name: "Ship", weight: "100" }] }],
      },
    };
    const res = mockRes();

    await submitKpiTemplateAssignment(req, res);

    expect(KraAssignment.insertMany).toHaveBeenCalledWith([
      {
        templateId,
        assignedTo: assigneeA,
        kras: [{ name: "Delivery", type: "functional", weight: 40, kpis: [{ title: "Ship", weight: 100 }], isEmployeeAdded: false }],
        status: "draft",
        createdBy: hr._id,
      },
      {
        templateId,
        assignedTo: assigneeB,
        kras: [{ name: "Delivery", type: "functional", weight: 40, kpis: [{ title: "Ship", weight: 100 }], isEmployeeAdded: false }],
        status: "draft",
        createdBy: hr._id,
      },
    ]);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
  });

  it("defaults templateId to null for ad-hoc (non-template) assignment", async () => {
    KraAssignment.insertMany.mockResolvedValue([{ _id: oid() }]);
    const req = { user: hrUser(), body: { assignees: [{ id: oid() }], kras: [] } };
    const res = mockRes();

    await submitKpiTemplateAssignment(req, res);

    expect(KraAssignment.insertMany.mock.calls[0][0][0].templateId).toBeNull();
  });
});

describe("updateKpiTemplateAssignment", () => {
  it("403s a plain employee", async () => {
    const req = { user: employeeUser(), body: { assignedToId: oid(), kras: [] } };
    const res = mockRes();

    await updateKpiTemplateAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraAssignment.findOne).not.toHaveBeenCalled();
  });

  it("404s when the assignee has no assignment", async () => {
    KraAssignment.findOne.mockReturnValue({ sort: vi.fn().mockResolvedValue(null) });
    const req = { user: hrUser(), body: { assignedToId: oid(), kras: [] } };
    const res = mockRes();

    await updateKpiTemplateAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("replaces kras and stamps updatedBy on the most recent assignment", async () => {
    const hr = hrUser();
    const assignedToId = oid();
    const assignment = { kras: [{ name: "Old" }], save: vi.fn().mockResolvedValue(undefined) };
    KraAssignment.findOne.mockReturnValue({ sort: vi.fn().mockResolvedValue(assignment) });
    const req = { user: hr, body: { assignedToId, kras: [{ name: "New", type: "functional", weight: 100, kpis: [] }] } };
    const res = mockRes();

    await updateKpiTemplateAssignment(req, res);

    expect(KraAssignment.findOne).toHaveBeenCalledWith({ assignedTo: assignedToId });
    expect(assignment.kras).toEqual([{ name: "New", type: "functional", weight: 100, kpis: [], isEmployeeAdded: false }]);
    expect(assignment.updatedBy).toBe(hr._id);
    expect(assignment.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(assignment);
  });
});

describe("updateKpiTemplateForUser", () => {
  it("403s a plain employee", async () => {
    const req = { user: employeeUser(), params: { userId: oid() }, body: { kras: [] } };
    const res = mockRes();

    await updateKpiTemplateForUser(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("404s when the user has no assignment", async () => {
    KraAssignment.findOne.mockReturnValue({ sort: vi.fn().mockResolvedValue(null) });
    const req = { user: hrUser(), params: { userId: oid() }, body: { kras: [] } };
    const res = mockRes();

    await updateKpiTemplateForUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updates the target user's assignment by userId param", async () => {
    const hr = hrUser();
    const userId = oid();
    const assignment = { kras: [], save: vi.fn().mockResolvedValue(undefined) };
    KraAssignment.findOne.mockReturnValue({ sort: vi.fn().mockResolvedValue(assignment) });
    const req = { user: hr, params: { userId }, body: { kras: [{ name: "New", type: "organizational", weight: 100, kpis: [] }] } };
    const res = mockRes();

    await updateKpiTemplateForUser(req, res);

    expect(KraAssignment.findOne).toHaveBeenCalledWith({ assignedTo: userId });
    expect(assignment.kras).toEqual([{ name: "New", type: "organizational", weight: 100, kpis: [], isEmployeeAdded: false }]);
    expect(assignment.updatedBy).toBe(hr._id);
    expect(res.json).toHaveBeenCalledWith(assignment);
  });
});

describe("getAssignmentByAssignee", () => {
  it("400s when assignedToId query param is missing", async () => {
    const req = { query: {}, user: hrUser() };
    const res = mockRes();

    await getAssignmentByAssignee(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("403s a stranger employee querying someone else's assignment (fixed: was ungated)", async () => {
    const req = { query: { assignedToId: oid().toString() }, user: employeeUser() };
    const res = mockRes();

    await getAssignmentByAssignee(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraAssignment.findOne).not.toHaveBeenCalled();
  });

  it("allows an employee to query their own assignment", async () => {
    KraAssignment.findOne.mockReturnValue({ sort: vi.fn().mockResolvedValue(null) });
    const self = employeeUser();
    const req = { query: { assignedToId: self._id.toString() }, user: self };
    const res = mockRes();

    await getAssignmentByAssignee(req, res);

    expect(res.json).toHaveBeenCalledWith(null);
  });

  it("returns null when the assignee has no assignment", async () => {
    KraAssignment.findOne.mockReturnValue({ sort: vi.fn().mockResolvedValue(null) });
    const req = { query: { assignedToId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await getAssignmentByAssignee(req, res);

    expect(res.json).toHaveBeenCalledWith(null);
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it("returns the assignment's kras (mapped through kraJson) and status", async () => {
    const kraId = oid();
    const assignment = {
      _id: oid(),
      status: "submitted",
      kras: [{ _id: kraId, name: "Delivery", type: "functional", weight: 40, kpis: [{ title: "Ship", weight: 100 }] }],
    };
    KraAssignment.findOne.mockReturnValue({ sort: vi.fn().mockResolvedValue(assignment) });
    const req = { query: { assignedToId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await getAssignmentByAssignee(req, res);

    expect(res.json).toHaveBeenCalledWith({
      id: assignment._id,
      kras: [{ id: kraId.toString(), name: "Delivery", type: "functional", weight: 40, kpis: [{ name: "Ship", title: "Ship", weight: 100 }] }],
      status: "submitted",
    });
  });
});
