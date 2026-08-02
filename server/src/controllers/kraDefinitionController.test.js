import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/KraDefinition.js", () => ({
  default: { find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), findOneAndDelete: vi.fn(), create: vi.fn() },
}));
vi.mock("../models/KraAssignment.js", () => ({ default: { find: vi.fn() } }));

import KraDefinition from "../models/KraDefinition.js";
import KraAssignment from "../models/KraAssignment.js";
import {
  listLibrary,
  addLibraryKra,
  removeLibraryKra,
  listMasterTemplates,
  getMasterTemplate,
  createMasterTemplate,
  updateMasterTemplate,
  deleteMasterTemplate,
} from "./kraDefinitionController.js";

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

// A library doc as returned by KraDefinition.find({scope:"library"}) — its
// `kras` is a Mongoose DocumentArray in real life, whose `.id()` looks a
// subdocument up by _id. We fake just that method.
const makeLibraryDoc = (type, entries) => ({
  type,
  kras: { id: (kraId) => entries.find((e) => e._id.toString() === kraId.toString()) },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listLibrary", () => {
  it("lists all library docs when no type filter is given", async () => {
    const docs = [{ type: "functional", kras: [] }];
    KraDefinition.find.mockResolvedValue(docs);
    const req = { query: {} };
    const res = mockRes();

    await listLibrary(req, res);

    expect(KraDefinition.find).toHaveBeenCalledWith({ scope: "library" });
    expect(res.json).toHaveBeenCalledWith(docs);
  });

  it("adds a type filter when ?type= is present", async () => {
    KraDefinition.find.mockResolvedValue([]);
    const req = { query: { type: "organizational" } };
    const res = mockRes();

    await listLibrary(req, res);

    expect(KraDefinition.find).toHaveBeenCalledWith({ scope: "library", type: "organizational" });
  });
});

describe("addLibraryKra", () => {
  it("403s a manager (HR-only, matches §02)", async () => {
    const req = { user: managerUser(), body: { type: "functional", name: "Delivery" } };
    const res = mockRes();

    await addLibraryKra(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraDefinition.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("403s a plain employee", async () => {
    const req = { user: employeeUser(), body: { type: "functional", name: "Delivery" } };
    const res = mockRes();

    await addLibraryKra(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("400s when type or name is missing", async () => {
    const req = { user: hrUser(), body: { name: "Delivery" } };
    const res = mockRes();

    await addLibraryKra(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(KraDefinition.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("upserts the per-type catalog doc and pushes the new KRA onto it", async () => {
    const hr = hrUser();
    const doc = { kras: [], save: vi.fn().mockResolvedValue(undefined) };
    KraDefinition.findOneAndUpdate.mockResolvedValue(doc);
    const req = { user: hr, body: { type: "functional", name: "Delivery", kpis: [{ title: "Ship on time", weight: 100 }] } };
    const res = mockRes();

    await addLibraryKra(req, res);

    expect(KraDefinition.findOneAndUpdate).toHaveBeenCalledWith(
      { scope: "library", type: "functional" },
      { $setOnInsert: { scope: "library", type: "functional", createdBy: hr._id } },
      { new: true, upsert: true },
    );
    expect(doc.kras).toEqual([{ name: "Delivery", type: "functional", kpis: [{ title: "Ship on time", weight: 100 }] }]);
    expect(doc.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(doc);
  });

  it("defaults kpis to an empty array when omitted", async () => {
    const doc = { kras: [], save: vi.fn().mockResolvedValue(undefined) };
    KraDefinition.findOneAndUpdate.mockResolvedValue(doc);
    const req = { user: hrUser(), body: { type: "organizational", name: "Culture" } };
    const res = mockRes();

    await addLibraryKra(req, res);

    expect(doc.kras[0].kpis).toEqual([]);
  });
});

describe("removeLibraryKra", () => {
  it("403s a manager", async () => {
    const req = { user: managerUser(), params: { type: "functional", kraId: oid().toString() } };
    const res = mockRes();

    await removeLibraryKra(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraDefinition.findOne).not.toHaveBeenCalled();
  });

  it("404s when no library catalog exists for the type", async () => {
    KraDefinition.findOne.mockResolvedValue(null);
    const req = { user: hrUser(), params: { type: "functional", kraId: oid().toString() } };
    const res = mockRes();

    await removeLibraryKra(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("removes only the targeted KRA entry and saves", async () => {
    const keep = { _id: oid() };
    const remove = { _id: oid() };
    const doc = { kras: [keep, remove], save: vi.fn().mockResolvedValue(undefined) };
    KraDefinition.findOne.mockResolvedValue(doc);
    const req = { user: hrUser(), params: { type: "functional", kraId: remove._id.toString() } };
    const res = mockRes();

    await removeLibraryKra(req, res);

    expect(KraDefinition.findOne).toHaveBeenCalledWith({ scope: "library", type: "functional" });
    expect(doc.kras).toEqual([keep]);
    expect(doc.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(doc);
  });
});

describe("listMasterTemplates", () => {
  it("lists master_template docs sorted newest first", async () => {
    const templates = [{ name: "B" }, { name: "A" }];
    const sort = vi.fn().mockResolvedValue(templates);
    KraDefinition.find.mockReturnValue({ sort });
    const res = mockRes();

    await listMasterTemplates({}, res);

    expect(KraDefinition.find).toHaveBeenCalledWith({ scope: "master_template" });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.json).toHaveBeenCalledWith(templates);
  });
});

describe("getMasterTemplate", () => {
  it("404s when the template doesn't exist", async () => {
    KraDefinition.findOne.mockResolvedValue(null);
    const req = { params: { id: oid() } };
    const res = mockRes();

    await getMasterTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("merges in assignedUsers alongside the plain template fields", async () => {
    const templateId = oid();
    const template = { _id: templateId, name: "Eng", toObject: () => ({ _id: templateId, name: "Eng" }) };
    KraDefinition.findOne.mockResolvedValue(template);
    const assignedUser = oid();
    KraAssignment.find.mockReturnValue({ distinct: vi.fn().mockResolvedValue([assignedUser]) });
    const req = { params: { id: templateId } };
    const res = mockRes();

    await getMasterTemplate(req, res);

    expect(KraAssignment.find).toHaveBeenCalledWith({ templateId });
    expect(res.json).toHaveBeenCalledWith({ _id: templateId, name: "Eng", assignedUsers: [assignedUser] });
  });
});

describe("createMasterTemplate", () => {
  it("403s a manager (HR-only)", async () => {
    const req = { user: managerUser(), body: { name: "Eng Template" } };
    const res = mockRes();

    await createMasterTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraDefinition.create).not.toHaveBeenCalled();
  });

  it("403s a plain employee", async () => {
    const req = { user: employeeUser(), body: { name: "Eng Template" } };
    const res = mockRes();

    await createMasterTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("400s when name is missing", async () => {
    const req = { user: hrUser(), body: {} };
    const res = mockRes();

    await createMasterTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(KraDefinition.create).not.toHaveBeenCalled();
  });

  it("resolves kraRefs against the current library, snapshotting name/type/kpis and linking originalId back", async () => {
    const libraryEntryId = oid();
    const libraryEntry = { _id: libraryEntryId, name: "Delivery", type: "functional", kpis: [{ title: "Ship on time", weight: 100 }] };
    KraDefinition.find.mockResolvedValue([makeLibraryDoc("functional", [libraryEntry])]);
    const created = { _id: oid() };
    KraDefinition.create.mockResolvedValue(created);
    const hr = hrUser();
    const req = { user: hr, body: { name: "Eng Template", kraRefs: [{ libraryType: "functional", kraId: libraryEntryId.toString() }] } };
    const res = mockRes();

    await createMasterTemplate(req, res);

    expect(KraDefinition.find).toHaveBeenCalledWith({ scope: "library" });
    expect(KraDefinition.create).toHaveBeenCalledWith({
      scope: "master_template",
      name: "Eng Template",
      kras: [{ originalId: libraryEntryId, name: "Delivery", type: "functional", kpis: libraryEntry.kpis }],
      createdBy: hr._id,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
  });

  it("silently skips a kraRef whose libraryType or kraId no longer resolves", async () => {
    const libraryEntry = { _id: oid(), name: "Delivery", type: "functional", kpis: [] };
    KraDefinition.find.mockResolvedValue([makeLibraryDoc("functional", [libraryEntry])]);
    KraDefinition.create.mockResolvedValue({ _id: oid() });
    const req = {
      user: hrUser(),
      body: { name: "Eng Template", kraRefs: [{ libraryType: "functional", kraId: oid().toString() }] },
    };
    const res = mockRes();

    await createMasterTemplate(req, res);

    expect(KraDefinition.create).toHaveBeenCalledWith(expect.objectContaining({ kras: [] }));
  });

  it("creates an empty-kras template when kraRefs is omitted", async () => {
    KraDefinition.create.mockResolvedValue({ _id: oid() });
    const req = { user: hrUser(), body: { name: "Empty Template" } };
    const res = mockRes();

    await createMasterTemplate(req, res);

    expect(KraDefinition.find).toHaveBeenCalledWith({ scope: "library" });
    expect(KraDefinition.create).toHaveBeenCalledWith(expect.objectContaining({ kras: [] }));
  });
});

describe("updateMasterTemplate", () => {
  it("403s a manager", async () => {
    const req = { user: managerUser(), params: { id: oid() }, body: {} };
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

  // This is the "does the template stay stable when the library changes"
  // case: a name-only update (kraRefs omitted) must NOT re-touch the
  // library at all, so previously-snapshotted kras survive untouched even
  // if the source library entry was edited or deleted in the meantime.
  it("leaves the template's snapshotted kras untouched when kraRefs is omitted, even if the library changed since", async () => {
    const originalKras = [{ originalId: oid(), name: "Delivery (old snapshot)", type: "functional", kpis: [] }];
    const template = { _id: oid(), name: "Old name", kras: originalKras, save: vi.fn().mockResolvedValue(undefined) };
    KraDefinition.findOne.mockResolvedValue(template);
    const req = { user: hrUser(), params: { id: template._id }, body: { name: "New name" } };
    const res = mockRes();

    await updateMasterTemplate(req, res);

    expect(KraDefinition.find).not.toHaveBeenCalled(); // library never re-queried
    expect(template.name).toBe("New name");
    expect(template.kras).toBe(originalKras);
    expect(template.save).toHaveBeenCalled();
  });

  it("re-resolves kraRefs against the current library when explicitly provided, refreshing the snapshot", async () => {
    const libraryEntryId = oid();
    const updatedLibraryEntry = { _id: libraryEntryId, name: "Delivery (renamed)", type: "functional", kpis: [{ title: "New KPI", weight: 100 }] };
    KraDefinition.find.mockResolvedValue([makeLibraryDoc("functional", [updatedLibraryEntry])]);
    const template = {
      _id: oid(),
      name: "Eng Template",
      kras: [{ originalId: libraryEntryId, name: "Delivery (stale)", type: "functional", kpis: [] }],
      save: vi.fn().mockResolvedValue(undefined),
    };
    KraDefinition.findOne.mockResolvedValue(template);
    const req = {
      user: hrUser(),
      params: { id: template._id },
      body: { kraRefs: [{ libraryType: "functional", kraId: libraryEntryId.toString() }] },
    };
    const res = mockRes();

    await updateMasterTemplate(req, res);

    expect(template.kras).toEqual([
      { originalId: libraryEntryId, name: "Delivery (renamed)", type: "functional", kpis: updatedLibraryEntry.kpis },
    ]);
    expect(template.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(template);
  });
});

describe("deleteMasterTemplate", () => {
  it("403s a manager", async () => {
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
