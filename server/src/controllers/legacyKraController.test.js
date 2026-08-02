import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/KraDefinition.js", () => ({
  default: { find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn() },
}));
vi.mock("../models/KraAssignment.js", () => ({
  default: { find: vi.fn(), findById: vi.fn(), findOne: vi.fn(), findByIdAndDelete: vi.fn(), exists: vi.fn() },
}));
vi.mock("../models/Submission.js", () => ({
  default: { findOne: vi.fn(), findOneAndUpdate: vi.fn() },
}));
vi.mock("../models/User.js", () => ({
  default: { find: vi.fn(), findById: vi.fn() },
}));

import KraDefinition from "../models/KraDefinition.js";
import KraAssignment from "../models/KraAssignment.js";
import Submission from "../models/Submission.js";
import User from "../models/User.js";
import {
  listKraLibrary,
  createKraLibraryEntries,
  updateKraLibraryEntry,
  deleteKraLibraryEntry,
  listPmsManagers,
  getEmployeeManager,
  listAssignedTemplates,
  deleteAssignment,
  getAssignmentSingle,
  updateAssignmentWeights,
  assignTemplatesToSelf,
  getByTemplate,
  saveKraDraft,
  submitKra,
  submitEmployeeReview,
  searchUserWithKra,
  saveActual,
} from "./legacyKraController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

// Mimics a Mongoose DocumentArray closely enough for `.id()` / `.pull()`
// subdocument lookups, while still being a plain array for map/filter/push.
const makeKraArray = (items = []) => {
  const arr = items.map((it) => ({ _id: it._id || oid(), ...it }));
  const nativePush = arr.push.bind(arr);
  // Real Mongoose DocumentArrays auto-assign an _id to pushed subdocuments
  // (assignedKraSchema uses `{ _id: true }`) — mimic that so ids pushed by
  // the controller under test are usable the same way real ones would be.
  arr.push = (...newItems) => nativePush(...newItems.map((it) => ({ _id: it._id || oid(), ...it })));
  arr.id = (id) => arr.find((k) => k._id.toString() === id.toString()) || null;
  arr.pull = (id) => {
    const idx = arr.findIndex((k) => k._id.toString() === id.toString());
    if (idx !== -1) arr.splice(idx, 1);
  };
  return arr;
};

const makeKpi = (obj) => {
  const kpi = { ...obj };
  kpi.toObject = () => ({ ...obj });
  return kpi;
};

const hrUser = () => ({ _id: oid(), roles: { pms: "hr" } });
const managerUser = () => ({ _id: oid(), roles: { pms: "manager" } });
const employeeUser = () => ({ _id: oid(), roles: { pms: "employee" } });

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────── KRA library ───────────────────────────

describe("listKraLibrary", () => {
  it("flattens KraDefinition docs into a flat KRA list, falling back to doc.type and kpi.name/index", async () => {
    const kpiWithId = { _id: oid(), title: "Ship on time" };
    const kpiNoId = { name: "Fallback KPI" };
    KraDefinition.find.mockResolvedValue([
      {
        type: "functional",
        kras: [
          { _id: oid(), name: "Delivery", type: undefined, kpis: [kpiWithId, kpiNoId] },
        ],
      },
    ]);
    const res = mockRes();

    await listKraLibrary({}, res);

    expect(KraDefinition.find).toHaveBeenCalledWith({ scope: "library" });
    expect(res.json).toHaveBeenCalledWith([
      {
        id: expect.any(String),
        name: "Delivery",
        type: "functional", // fell back to doc.type since kra.type was undefined
        kpis: [
          { id: kpiWithId._id.toString(), name: "Ship on time" },
          { id: "kpi-1", name: "Fallback KPI" },
        ],
      },
    ]);
  });
});

describe("createKraLibraryEntries", () => {
  it("403s a caller who is neither PMS HR nor manager", async () => {
    const req = { body: { type: "functional", kras: [{ name: "x" }] }, user: employeeUser() };
    const res = mockRes();

    await createKraLibraryEntries(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraDefinition.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // The KRA library is HR-curated content: unlike assigning it to people
  // (Manager, HR), only HR may add/edit/remove library entries.
  it("403s a PMS manager caller (library is HR-only)", async () => {
    const req = { body: { type: "functional", kras: [{ name: "x" }] }, user: managerUser() };
    const res = mockRes();

    await createKraLibraryEntries(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraDefinition.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("allows PMS hr to create library entries", async () => {
    const doc = { kras: makeKraArray([]), save: vi.fn().mockResolvedValue(undefined) };
    KraDefinition.findOneAndUpdate.mockResolvedValue(doc);
    const user = hrUser();
    const req = {
      body: { type: "functional", kras: [{ name: "Deliver features", kpis: [{ name: "Feature count" }] }] },
      user,
    };
    const res = mockRes();

    await createKraLibraryEntries(req, res);

    expect(KraDefinition.findOneAndUpdate).toHaveBeenCalledWith(
      { scope: "library", type: "functional" },
      { $setOnInsert: { scope: "library", type: "functional", createdBy: user._id } },
      { new: true, upsert: true },
    );
    expect(doc.kras[0]).toMatchObject({
      name: "Deliver features",
      type: "functional",
      kpis: [{ title: "Feature count" }],
    });
    expect(doc.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: "KRA created" });
  });

  it("400s when type is missing", async () => {
    const req = { body: { kras: [{ name: "x" }] }, user: hrUser() };
    const res = mockRes();

    await createKraLibraryEntries(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(KraDefinition.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("400s when kras is missing or empty", async () => {
    const req = { body: { type: "functional", kras: [] }, user: hrUser() };
    const res = mockRes();

    await createKraLibraryEntries(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(KraDefinition.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("updateKraLibraryEntry", () => {
  it("403s a non hr/manager caller", async () => {
    const req = { params: { kraId: oid().toString() }, body: {}, user: employeeUser() };
    const res = mockRes();

    await updateKraLibraryEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraDefinition.findOne).not.toHaveBeenCalled();
  });

  it("404s when no library doc contains that KRA id", async () => {
    KraDefinition.findOne.mockResolvedValue(null);
    const req = { params: { kraId: oid().toString() }, body: { name: "New" }, user: hrUser() };
    const res = mockRes();

    await updateKraLibraryEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("400s when the KRA is already referenced by an assignment", async () => {
    const kraId = oid().toString();
    KraDefinition.findOne.mockResolvedValue({ kras: makeKraArray([{ _id: kraId, name: "Old" }]) });
    KraAssignment.exists.mockResolvedValue(true);
    const req = { params: { kraId }, body: { name: "New" }, user: hrUser() };
    const res = mockRes();

    await updateKraLibraryEntry(req, res);

    expect(KraAssignment.exists).toHaveBeenCalledWith({ "kras.defRef": kraId });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ detail: "This KRA is already used in a template and cannot be edited." });
  });

  it("403s a PMS manager caller (library is HR-only)", async () => {
    const kraId = oid().toString();
    const req = { params: { kraId }, body: { name: "New Name" }, user: managerUser() };
    const res = mockRes();

    await updateKraLibraryEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraDefinition.findOne).not.toHaveBeenCalled();
  });

  it("updates name/kpis but leaves type untouched when not provided", async () => {
    const kraId = oid().toString();
    const doc = { kras: makeKraArray([{ _id: kraId, name: "Old", type: "functional" }]), save: vi.fn().mockResolvedValue(undefined) };
    KraDefinition.findOne.mockResolvedValue(doc);
    KraAssignment.exists.mockResolvedValue(false);
    const req = { params: { kraId }, body: { name: "New Name", kpis: [{ name: "KPI1" }] }, user: hrUser() };
    const res = mockRes();

    await updateKraLibraryEntry(req, res);

    const entry = doc.kras.id(kraId);
    expect(entry.name).toBe("New Name");
    expect(entry.type).toBe("functional");
    expect(entry.kpis).toEqual([{ title: "KPI1" }]);
    expect(doc.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: "KRA updated" });
  });
});

describe("deleteKraLibraryEntry", () => {
  it("403s a non hr/manager caller", async () => {
    const req = { params: { kraId: oid().toString() }, user: employeeUser() };
    const res = mockRes();

    await deleteKraLibraryEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraAssignment.exists).not.toHaveBeenCalled();
  });

  it("400s when the KRA is already in use", async () => {
    KraAssignment.exists.mockResolvedValue(true);
    const req = { params: { kraId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await deleteKraLibraryEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ detail: "Cannot delete. This KRA is already used in a template." });
    expect(KraDefinition.findOne).not.toHaveBeenCalled();
  });

  it("404s when not in use but no library doc contains it", async () => {
    KraAssignment.exists.mockResolvedValue(false);
    KraDefinition.findOne.mockResolvedValue(null);
    const req = { params: { kraId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await deleteKraLibraryEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403s a PMS manager caller (library is HR-only)", async () => {
    const kraId = oid().toString();
    const req = { params: { kraId }, user: managerUser() };
    const res = mockRes();

    await deleteKraLibraryEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraAssignment.exists).not.toHaveBeenCalled();
  });

  it("pulls the subdocument and returns 204 on success", async () => {
    const kraId = oid().toString();
    KraAssignment.exists.mockResolvedValue(false);
    const doc = { kras: makeKraArray([{ _id: kraId, name: "Old" }]), save: vi.fn().mockResolvedValue(undefined) };
    KraDefinition.findOne.mockResolvedValue(doc);
    const req = { params: { kraId }, user: hrUser() };
    const res = mockRes();

    await deleteKraLibraryEntry(req, res);

    expect(doc.kras.find((k) => k._id.toString() === kraId)).toBeUndefined();
    expect(doc.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
});

// ─────────────────────────── Managers ───────────────────────────

describe("listPmsManagers", () => {
  it("returns PMS managers with id/_id/name/email", async () => {
    const m = { _id: oid(), name: "Mia Manager", email: "mia@co.com" };
    User.find.mockReturnValue({ select: vi.fn().mockResolvedValue([m]) });
    const res = mockRes();

    await listPmsManagers({}, res);

    expect(User.find).toHaveBeenCalledWith({ "roles.pms": "manager" });
    expect(res.json).toHaveBeenCalledWith([{ id: m._id, _id: m._id, name: m.name, email: m.email }]);
  });
});

describe("getEmployeeManager", () => {
  it("404s when the employee doesn't exist", async () => {
    User.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(null) });
    const req = { params: { employeeId: oid().toString() } };
    const res = mockRes();

    await getEmployeeManager(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns null when the employee has no manager", async () => {
    User.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue({ managerId: null }) });
    const req = { params: { employeeId: oid().toString() } };
    const res = mockRes();

    await getEmployeeManager(req, res);

    expect(res.json).toHaveBeenCalledWith(null);
  });

  it("returns the populated manager", async () => {
    const manager = { _id: oid(), name: "Mia Manager", email: "mia@co.com" };
    User.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue({ managerId: manager }) });
    const req = { params: { employeeId: oid().toString() } };
    const res = mockRes();

    await getEmployeeManager(req, res);

    expect(res.json).toHaveBeenCalledWith({ id: manager._id, name: manager.name, email: manager.email });
  });
});

// ─────────────────────────── Assignments ───────────────────────────

describe("listAssignedTemplates", () => {
  it("filters out employee-added KRAs and formats base KRA ids", async () => {
    const assignmentId = oid();
    const baseKra = { _id: oid(), name: "Base KRA", weight: 50, kpis: [], isEmployeeAdded: false };
    const employeeKra = { _id: oid(), name: "Self-added KRA", weight: 0, kpis: [], isEmployeeAdded: true };
    KraAssignment.find.mockResolvedValue([
      { _id: assignmentId, cycleId: "cycle-1", status: "draft", kras: [baseKra, employeeKra] },
    ]);
    const req = { params: { employeeId: oid().toString() } };
    const res = mockRes();

    await listAssignedTemplates(req, res);

    expect(KraAssignment.find).toHaveBeenCalledWith({ assignedTo: req.params.employeeId });
    expect(res.json).toHaveBeenCalledWith([
      {
        _id: assignmentId,
        cycleId: "cycle-1",
        status: "draft",
        kras: [
          { kraId: `${assignmentId}-base-${baseKra._id}`, name: "Base KRA", weight: 50, kpis: [] },
        ],
      },
    ]);
  });
});

describe("deleteAssignment", () => {
  it("403s a non hr/manager caller", async () => {
    const req = { params: { id: oid().toString() }, user: employeeUser() };
    const res = mockRes();

    await deleteAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraAssignment.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it("404s when the assignment doesn't exist", async () => {
    KraAssignment.findByIdAndDelete.mockResolvedValue(null);
    const req = { params: { id: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await deleteAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("204s on successful delete (manager allowed)", async () => {
    KraAssignment.findByIdAndDelete.mockResolvedValue({ _id: oid() });
    const req = { params: { id: oid().toString() }, user: managerUser() };
    const res = mockRes();

    await deleteAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
});

describe("getAssignmentSingle", () => {
  it("404s when the assignment doesn't exist", async () => {
    KraAssignment.findById.mockResolvedValue(null);
    const req = { params: { id: oid().toString() } };
    const res = mockRes();

    await getAssignmentSingle(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("maps kras/kpis, falling back from title to name", async () => {
    const assignment = {
      _id: oid(),
      kras: [
        {
          _id: oid(),
          name: "KRA 1",
          weight: 40,
          kpis: [{ title: "Has title", weight: 10 }, { name: "Only name", weight: 20 }],
        },
      ],
    };
    KraAssignment.findById.mockResolvedValue(assignment);
    const req = { params: { id: assignment._id.toString() } };
    const res = mockRes();

    await getAssignmentSingle(req, res);

    expect(res.json).toHaveBeenCalledWith({
      id: assignment._id,
      kras: [
        {
          id: assignment.kras[0]._id,
          name: "KRA 1",
          weight: 40,
          kpis: [{ name: "Has title", weight: 10 }, { name: "Only name", weight: 20 }],
        },
      ],
    });
  });
});

describe("updateAssignmentWeights", () => {
  it("403s a non hr/manager caller", async () => {
    const req = { params: { id: oid().toString() }, body: { kras: [] }, user: employeeUser() };
    const res = mockRes();

    await updateAssignmentWeights(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraAssignment.findById).not.toHaveBeenCalled();
  });

  it("404s when the assignment doesn't exist", async () => {
    KraAssignment.findById.mockResolvedValue(null);
    const req = { params: { id: oid().toString() }, body: { kras: [] }, user: hrUser() };
    const res = mockRes();

    await updateAssignmentWeights(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updates weight/kpis for matched KRAs and silently skips unmatched ids", async () => {
    const kra1Id = oid();
    const oldKpi = makeKpi({ title: "Old KPI", weight: 10, description: "kept" });
    const assignment = {
      kras: makeKraArray([{ _id: kra1Id, name: "KRA 1", weight: 20, kpis: [oldKpi] }]),
      save: vi.fn().mockResolvedValue(undefined),
    };
    KraAssignment.findById.mockResolvedValue(assignment);
    const req = {
      params: { id: oid().toString() },
      body: {
        kras: [
          { id: kra1Id.toString(), weight: 60, kpis: [{ name: "New KPI name", weight: 30 }] },
          { id: oid().toString(), weight: 99 }, // no matching subdocument -> ignored
        ],
      },
      user: hrUser(),
    };
    const res = mockRes();

    await updateAssignmentWeights(req, res);

    const target = assignment.kras.id(kra1Id.toString());
    expect(target.weight).toBe(60);
    expect(target.kpis).toEqual([{ title: "New KPI name", weight: 30, description: "kept" }]);
    expect(assignment.updatedBy).toBe(req.user._id);
    expect(assignment.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: "Template updated" });
  });
});

describe("assignTemplatesToSelf", () => {
  it("400s when templateIds is missing or empty", async () => {
    const req = { body: { templateIds: [] }, user: employeeUser() };
    const res = mockRes();

    await assignTemplatesToSelf(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(KraDefinition.find).not.toHaveBeenCalled();
  });

  it("400s when the caller has no active KRA assignment", async () => {
    KraDefinition.find.mockResolvedValue([]);
    KraAssignment.findOne.mockReturnValue({ sort: vi.fn().mockResolvedValue(null) });
    const req = { body: { templateIds: [oid().toString()] }, user: employeeUser() };
    const res = mockRes();

    await assignTemplatesToSelf(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "No active KRA assignment found for the current cycle" });
  });

  it("appends master-template KRAs to the active assignment as employee-added, zero-weight entries", async () => {
    const originalId = oid();
    KraDefinition.find.mockResolvedValue([
      { kras: [{ originalId, name: "Bundled KRA", type: "organizational", kpis: [{ title: "K1" }] }] },
    ]);
    const activeAssignment = { kras: [], save: vi.fn().mockResolvedValue(undefined) };
    KraAssignment.findOne.mockReturnValue({ sort: vi.fn().mockResolvedValue(activeAssignment) });
    const req = { body: { templateIds: [oid().toString()] }, user: employeeUser() };
    const res = mockRes();

    await assignTemplatesToSelf(req, res);

    expect(activeAssignment.kras).toEqual([
      {
        defRef: originalId,
        name: "Bundled KRA",
        type: "organizational",
        weight: 0,
        kpis: [{ title: "K1" }],
        isEmployeeAdded: true,
      },
    ]);
    expect(activeAssignment.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: "Templates assigned successfully" });
  });
});

// ─────────────────────────── KRA fill-out / submission ───────────────────────────

describe("getByTemplate", () => {
  it("returns exists:false without querying submissions when the assignment is missing", async () => {
    KraAssignment.findById.mockResolvedValue(null);
    const req = { params: { templateId: oid().toString(), employeeId: oid().toString() } };
    const res = mockRes();

    await getByTemplate(req, res);

    expect(res.json).toHaveBeenCalledWith({ exists: false });
    expect(Submission.findOne).not.toHaveBeenCalled();
  });

  it("builds the view model with empty responses/ratings and falls back to assignment.status when there's no submission", async () => {
    const assignmentId = oid();
    const kraSubId = oid();
    const assignment = {
      _id: assignmentId,
      status: "draft",
      kras: [
        {
          _id: kraSubId,
          name: "KRA 1",
          weight: 100,
          isEmployeeAdded: false,
          kpis: [{ title: "KPI 1", weight: 100, actual: "", target: "5" }],
        },
      ],
    };
    KraAssignment.findById.mockResolvedValue(assignment);
    Submission.findOne.mockResolvedValue(null);
    const req = { params: { templateId: assignmentId.toString(), employeeId: oid().toString() } };
    const res = mockRes();

    await getByTemplate(req, res);

    expect(res.json).toHaveBeenCalledWith({
      exists: true,
      kras: [
        {
          kraId: `${assignmentId}-base-${kraSubId}`,
          _id: kraSubId,
          name: "KRA 1",
          weight: 100,
          kpis: [{ title: "KPI 1", name: "KPI 1", weight: 100, actual: "", target: "5" }],
        },
      ],
      responses: {},
      ratings: {},
      status: "draft",
      kraStatuses: {},
    });
  });

  it("merges submission responses/ratings and prefers response kpi actual/target over the stored defaults", async () => {
    const assignmentId = oid();
    const kraSubId = oid();
    const assignment = {
      _id: assignmentId,
      status: "draft",
      kras: [
        {
          _id: kraSubId,
          name: "KRA 1",
          weight: 100,
          isEmployeeAdded: false,
          kpis: [{ title: "KPI 1", weight: 100, actual: "", target: "5" }],
        },
      ],
    };
    KraAssignment.findById.mockResolvedValue(assignment);
    Submission.findOne.mockResolvedValue({
      status: "employee_submitted",
      kraResponses: [
        { kraId: kraSubId, response: "Did well", rating: 4, kpis: [{ actual: "7", target: "9" }] },
      ],
    });
    const req = { params: { templateId: assignmentId.toString(), employeeId: oid().toString() } };
    const res = mockRes();

    await getByTemplate(req, res);

    const kraId = `${assignmentId}-base-${kraSubId}`;
    expect(res.json).toHaveBeenCalledWith({
      exists: true,
      kras: [
        {
          kraId,
          _id: kraSubId,
          name: "KRA 1",
          weight: 100,
          kpis: [{ title: "KPI 1", name: "KPI 1", weight: 100, actual: "7", target: "9" }],
        },
      ],
      responses: { [kraId]: "Did well" },
      ratings: { [kraId]: 4 },
      status: "employee_submitted",
      kraStatuses: {},
    });
  });
});

describe("saveKraDraft", () => {
  it("404s (message key) when the assignment doesn't exist", async () => {
    KraAssignment.findById.mockResolvedValue(null);
    const req = { body: { templateId: oid().toString(), employeeId: oid().toString(), kras: [] } };
    const res = mockRes();

    await saveKraDraft(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Template not found" });
  });

  it("persists newly-drafted employee KRAs onto the assignment and upserts a draft submission", async () => {
    const existingSubId = oid();
    const assignment = {
      _id: oid(),
      cycleId: "cycle-1",
      status: "draft",
      kras: makeKraArray([{ _id: existingSubId, name: "Existing", isEmployeeAdded: false }]),
      save: vi.fn().mockResolvedValue(undefined),
    };
    KraAssignment.findById.mockResolvedValue(assignment);
    Submission.findOneAndUpdate.mockResolvedValue({ _id: oid() });
    const employeeId = oid().toString();
    const req = {
      body: {
        templateId: assignment._id.toString(),
        employeeId,
        kras: [
          { id: existingSubId.toString(), name: "Existing", weight: 50 },
          { name: "Brand new self KRA", weight: 20, kpis: [{ name: "K1", weight: 100 }] },
        ],
      },
    };
    const res = mockRes();

    await saveKraDraft(req, res);

    // The new KRA (no matching id) is pushed as employee-added.
    expect(assignment.kras.some((k) => k.name === "Brand new self KRA" && k.isEmployeeAdded)).toBe(true);
    expect(assignment.save).toHaveBeenCalledTimes(1); // status stays "draft" -> no second save
    expect(Submission.findOneAndUpdate).toHaveBeenCalledWith(
      { assignmentId: assignment._id.toString(), employeeId },
      expect.objectContaining({ $set: expect.objectContaining({ status: "draft" }) }),
      { new: true, upsert: true },
    );
    expect(res.json).toHaveBeenCalledWith({ message: "Draft saved" });
  });
});

describe("submitKra", () => {
  it("404s with a `detail` key (not `message`) when the assignment doesn't exist", async () => {
    KraAssignment.findById.mockResolvedValue(null);
    const req = { body: { templateId: oid().toString(), employeeId: oid().toString(), kras: [] } };
    const res = mockRes();

    await submitKra(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ detail: "Template not found" });
  });

  it("saves the assignment status and submits for manager approval", async () => {
    const assignment = {
      _id: oid(),
      cycleId: "cycle-1",
      status: "draft",
      kras: makeKraArray([]),
      save: vi.fn().mockResolvedValue(undefined),
    };
    KraAssignment.findById.mockResolvedValue(assignment);
    Submission.findOneAndUpdate.mockResolvedValue({ _id: oid() });
    const req = { body: { templateId: assignment._id.toString(), employeeId: oid().toString(), kras: [] } };
    const res = mockRes();

    await submitKra(req, res);

    expect(assignment.status).toBe("pending_manager_approval");
    // Once for persisting new employee KRAs, once more for the status change.
    expect(assignment.save).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({ message: "Submitted for approval" });
  });
});

describe("submitEmployeeReview", () => {
  it("uses employee_submitted when there's no prior manager_reviewed submission", async () => {
    Submission.findOne.mockResolvedValue(null);
    const assignment = { _id: oid(), cycleId: "c1", kras: makeKraArray([]), save: vi.fn().mockResolvedValue(undefined) };
    KraAssignment.findById.mockResolvedValue(assignment);
    Submission.findOneAndUpdate.mockResolvedValue({ _id: oid() });
    const req = { body: { templateId: assignment._id.toString(), employeeId: oid().toString(), kras: [] } };
    const res = mockRes();

    await submitEmployeeReview(req, res);

    expect(Submission.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ $set: expect.objectContaining({ status: "employee_submitted" }) }),
      expect.anything(),
    );
    expect(res.json).toHaveBeenCalledWith({ message: "Self review submitted" });
  });

  it("uses final_employee_submitted when the existing submission was manager_reviewed", async () => {
    Submission.findOne.mockResolvedValue({ status: "manager_reviewed" });
    const assignment = { _id: oid(), cycleId: "c1", kras: makeKraArray([]), save: vi.fn().mockResolvedValue(undefined) };
    KraAssignment.findById.mockResolvedValue(assignment);
    Submission.findOneAndUpdate.mockResolvedValue({ _id: oid() });
    const req = { body: { templateId: assignment._id.toString(), employeeId: oid().toString(), kras: [] } };
    const res = mockRes();

    await submitEmployeeReview(req, res);

    expect(Submission.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ $set: expect.objectContaining({ status: "final_employee_submitted" }) }),
      expect.anything(),
    );
  });

  it("propagates a 404 with `detail` key when the assignment is missing", async () => {
    Submission.findOne.mockResolvedValue(null);
    KraAssignment.findById.mockResolvedValue(null);
    const req = { body: { templateId: oid().toString(), employeeId: oid().toString(), kras: [] } };
    const res = mockRes();

    await submitEmployeeReview(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ detail: "Template not found" });
  });
});

describe("searchUserWithKra", () => {
  it("builds the archived/name filter and groups assignments by user", async () => {
    const user1 = { _id: oid(), name: "Alice", email: "alice@co.com", roles: { pms: "employee" }, managerId: { _id: oid(), name: "Boss" } };
    const selectMock = vi.fn().mockReturnValue({ populate: vi.fn().mockResolvedValue([user1]) });
    User.find.mockReturnValue({ select: selectMock });
    const createdBy = { name: "Helen HR" };
    const populateMock = vi.fn().mockReturnValue({ sort: vi.fn().mockResolvedValue([
      { assignedTo: user1._id, createdAt: "2026-01-01", createdBy },
    ]) });
    KraAssignment.find.mockReturnValue({ populate: populateMock });

    const req = { query: { name: "alice", archived: "false" } };
    const res = mockRes();

    await searchUserWithKra(req, res);

    expect(User.find).toHaveBeenCalledWith({
      "archived.pms": false,
      name: { $regex: "alice", $options: "i" },
    });
    expect(res.json).toHaveBeenCalledWith([
      {
        id: user1._id,
        name: "Alice",
        email: "alice@co.com",
        role: "employee",
        hasKRA: true,
        kras: [{ assignedAt: "2026-01-01", assignedBy: "Helen HR" }],
        manager_id: user1.managerId._id,
        manager_name: "Boss",
      },
    ]);
  });

  it("defaults archived to false and omits the name filter when name is blank", async () => {
    const selectMock = vi.fn().mockReturnValue({ populate: vi.fn().mockResolvedValue([]) });
    User.find.mockReturnValue({ select: selectMock });
    KraAssignment.find.mockReturnValue({ populate: vi.fn().mockReturnValue({ sort: vi.fn().mockResolvedValue([]) }) });

    const req = { query: {} };
    const res = mockRes();

    await searchUserWithKra(req, res);

    expect(User.find).toHaveBeenCalledWith({ "archived.pms": false });
  });
});

describe("saveActual", () => {
  it("404s when there's no submission for the assignment/employee", async () => {
    Submission.findOne.mockResolvedValue(null);
    const req = { body: { templateId: oid().toString(), employeeId: oid().toString(), kraId: oid().toString(), kpiIndex: 0, actual: "5" } };
    const res = mockRes();

    await saveActual(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Submission not found" });
  });

  it("404s when the submission has no response for that KRA", async () => {
    Submission.findOne.mockResolvedValue({ kraResponses: [] });
    const req = { body: { templateId: oid().toString(), employeeId: oid().toString(), kraId: oid().toString(), kpiIndex: 0, actual: "5" } };
    const res = mockRes();

    await saveActual(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "KRA response not found" });
  });

  it("strips the -base- assignment prefix to resolve the subdocument id and updates the kpi's actual", async () => {
    const subId = oid();
    const response = { kraId: subId, kpis: [{ actual: "old" }] };
    const submission = { kraResponses: [response], markModified: vi.fn(), save: vi.fn().mockResolvedValue(undefined) };
    Submission.findOne.mockResolvedValue(submission);
    const assignmentId = oid();
    const req = {
      body: {
        templateId: oid().toString(),
        employeeId: oid().toString(),
        kraId: `${assignmentId}-base-${subId}`,
        kpiIndex: 0,
        actual: "9",
      },
    };
    const res = mockRes();

    await saveActual(req, res);

    expect(response.kpis[0]).toEqual({ actual: "9" });
    expect(submission.markModified).toHaveBeenCalledWith("kraResponses");
    expect(submission.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: "Saved" });
  });
});
