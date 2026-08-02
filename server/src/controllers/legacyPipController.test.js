import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Pip.js", () => ({
  default: { find: vi.fn(), findById: vi.fn(), create: vi.fn() },
}));
vi.mock("../config/blobStorage.js", () => ({
  createReadUrl: vi.fn(),
  uploadAttachment: vi.fn(),
}));
// legacyPipController.js has no notify/email import at all today — kept here
// so the intended-notification tests below (marked .todo) are ready to flip
// on the moment someone wires notifications up.
vi.mock("../utils/notify.js", () => ({ notifyUsers: vi.fn() }));

import Pip from "../models/Pip.js";
import { createReadUrl, uploadAttachment } from "../config/blobStorage.js";
import { notifyUsers } from "../utils/notify.js";
import {
  getProofUrl,
  listEmployeePips,
  listAllPips,
  createPip,
  updatePipLegacy,
  employeeUpdatePip,
} from "./legacyPipController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getProofUrl", () => {
  it("400s when blob_name is missing", async () => {
    const req = { query: {} };
    const res = mockRes();

    await getProofUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(createReadUrl).not.toHaveBeenCalled();
  });

  it("returns a read URL for the given blob_name", async () => {
    createReadUrl.mockReturnValue("https://blob.example/container/pips/abc?sig=1");
    const req = { query: { blob_name: "pips/abc" } };
    const res = mockRes();

    await getProofUrl(req, res);

    expect(createReadUrl).toHaveBeenCalledWith("pips/abc");
    expect(res.json).toHaveBeenCalledWith({ url: "https://blob.example/container/pips/abc?sig=1" });
  });
});

describe("listEmployeePips", () => {
  it("returns the employee's own PIPs sorted newest-first, with an id alias", async () => {
    const employeeId = oid();
    const doc = { _id: oid(), employeeId, toObject: () => ({ _id: doc._id, employeeId }) };
    const sort = vi.fn().mockResolvedValue([doc]);
    Pip.find.mockReturnValue({ sort });
    const req = { params: { employeeId: employeeId.toString() }, user: { _id: employeeId, roles: { pms: "employee" } } };
    const res = mockRes();

    await listEmployeePips(req, res);

    expect(Pip.find).toHaveBeenCalledWith({ employeeId: employeeId.toString() });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ id: doc._id })]);
  });

  it("allows a manager/HR caller to view any employee's PIPs", async () => {
    const employeeId = oid();
    const sort = vi.fn().mockResolvedValue([]);
    Pip.find.mockReturnValue({ sort });
    const req = { params: { employeeId: employeeId.toString() }, user: { _id: oid(), roles: { pms: "hr" } } };
    const res = mockRes();

    await listEmployeePips(req, res);

    expect(res.json).toHaveBeenCalled();
  });

  // Fixed access-control gap (was: legacyPipController.js:10-13 had no
  // ownership check at all).
  it("403s an employee requesting another employee's PIPs", async () => {
    const req = {
      params: { employeeId: oid().toString() },
      user: { _id: oid(), roles: { pms: "employee" } },
    };
    const res = mockRes();

    await listEmployeePips(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Pip.find).not.toHaveBeenCalled();
  });
});

describe("listAllPips", () => {
  it("returns every PIP with both id and legacy employee_id aliases", async () => {
    const employeeId = oid();
    const doc = { _id: oid(), employeeId, toObject: () => ({ _id: doc._id, employeeId }) };
    const sort = vi.fn().mockResolvedValue([doc]);
    Pip.find.mockReturnValue({ sort });
    const req = { user: { _id: oid(), roles: { pms: "hr" } } };
    const res = mockRes();

    await listAllPips(req, res);

    expect(Pip.find).toHaveBeenCalledWith({});
    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ id: doc._id, employee_id: employeeId })]);
  });

  // Fixed access-control gap (was: legacyPipController.js:17-20 had no role check).
  it("403s an employee (non-manager/HR) from listing all PIPs company-wide", async () => {
    const req = { user: { _id: oid(), roles: { pms: "employee" } } };
    const res = mockRes();

    await listAllPips(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Pip.find).not.toHaveBeenCalled();
  });
});

describe("createPip (legacy)", () => {
  it("403s an employee trying to open a PIP", async () => {
    const req = {
      body: { employee_id: oid(), startDate: "2026-01-01", targetEndDate: "2026-03-01" },
      user: { _id: oid(), roles: { pms: "employee" } },
    };
    const res = mockRes();

    await createPip(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Pip.create).not.toHaveBeenCalled();
  });

  it("400s when employee_id, startDate, or targetEndDate is missing", async () => {
    const req = { body: { startDate: "2026-01-01" }, user: { _id: oid(), roles: { pms: "hr" } } };
    const res = mockRes();

    await createPip(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Pip.create).not.toHaveBeenCalled();
  });

  it("creates a PIP from snake_case employee_id and returns it with an id alias", async () => {
    const hrId = oid();
    const employeeId = oid();
    const created = { _id: oid(), employeeId, toObject: () => ({ _id: created._id, employeeId }) };
    Pip.create.mockResolvedValue(created);
    const req = {
      body: {
        employee_id: employeeId,
        startDate: "2026-01-01",
        targetEndDate: "2026-03-01",
        reason: "Quality issues",
        goals: [{ title: "Reduce bug count" }],
      },
      user: { _id: hrId, roles: { pms: "hr" } },
    };
    const res = mockRes();

    await createPip(req, res);

    expect(Pip.create).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId,
        startDate: "2026-01-01",
        targetEndDate: "2026-03-01",
        reason: "Quality issues",
        createdBy: hrId,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: created._id }));
  });

  // BUG (doc §07 "PIP created/updated → employee"): legacy createPip
  // (src/controllers/legacyPipController.js:30-49) never notifies the employee.
  it.todo("notifies the employee when a PIP is created for them", async () => {
    const employeeId = oid();
    Pip.create.mockResolvedValue({ _id: oid(), toObject: () => ({}) });
    const req = {
      body: { employee_id: employeeId, startDate: "2026-01-01", targetEndDate: "2026-03-01" },
      user: { _id: oid(), roles: { pms: "manager" } },
    };
    const res = mockRes();

    await createPip(req, res);

    expect(notifyUsers).toHaveBeenCalledWith([employeeId], expect.objectContaining({ type: expect.any(String) }));
  });
});

describe("updatePipLegacy", () => {
  it("403s an employee trying to close out a PIP", async () => {
    const req = { params: { id: oid() }, body: { status: "completed" }, user: { _id: oid(), roles: { pms: "employee" } } };
    const res = mockRes();

    await updatePipLegacy(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Pip.findById).not.toHaveBeenCalled();
  });

  it("404s when the PIP doesn't exist", async () => {
    Pip.findById.mockResolvedValue(null);
    const req = { params: { id: oid() }, body: { status: "completed" }, user: { _id: oid(), roles: { pms: "manager" } } };
    const res = mockRes();

    await updatePipLegacy(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("lets a manager update status, outcome, dates, reason, reviewNotes, and goals", async () => {
    const managerId = oid();
    const pip = {
      status: "active",
      outcome: null,
      startDate: "2026-01-01",
      targetEndDate: "2026-03-01",
      reason: "old reason",
      reviewNotes: "",
      goals: [],
      toObject: () => ({ status: pip.status }),
      save: vi.fn().mockResolvedValue(undefined),
    };
    Pip.findById.mockResolvedValue(pip);
    const req = {
      params: { id: oid() },
      body: {
        status: "completed",
        outcome: "improved",
        startDate: "2026-01-02",
        targetEndDate: "2026-04-01",
        reason: "new reason",
        reviewNotes: "great improvement",
        goals: [{ title: "goal" }],
      },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await updatePipLegacy(req, res);

    expect(pip.status).toBe("completed");
    expect(pip.outcome).toBe("improved");
    expect(pip.startDate).toBe("2026-01-02");
    expect(pip.targetEndDate).toBe("2026-04-01");
    expect(pip.reason).toBe("new reason");
    expect(pip.reviewNotes).toBe("great improvement");
    expect(pip.goals).toEqual([{ title: "goal" }]);
    expect(pip.updatedBy).toBe(managerId);
    expect(pip.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));
  });

  // Fixed (doc §04 step 3 "Re-opens the employee's ability to submit another
  // update"): updatePipLegacy now resets pip.employeeSubmitted on close-out.
  it("resets employeeSubmitted to false when the manager closes out the review", async () => {
    const pip = {
      employeeSubmitted: true,
      toObject: () => ({}),
      save: vi.fn().mockResolvedValue(undefined),
    };
    Pip.findById.mockResolvedValue(pip);
    const req = {
      params: { id: oid() },
      body: { status: "completed", outcome: "improved" },
      user: { _id: oid(), roles: { pms: "manager" } },
    };
    const res = mockRes();

    await updatePipLegacy(req, res);

    expect(pip.employeeSubmitted).toBe(false);
  });
});

describe("employeeUpdatePip", () => {
  it("404s when the PIP doesn't exist", async () => {
    Pip.findById.mockResolvedValue(null);
    const req = { params: { id: oid() }, body: {}, user: { _id: oid() }, files: [] };
    const res = mockRes();

    await employeeUpdatePip(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403s an employee submitting an update for someone else's PIP", async () => {
    const pip = { employeeId: { equals: vi.fn().mockReturnValue(false) } };
    Pip.findById.mockResolvedValue(pip);
    const req = { params: { id: oid() }, body: { goalUpdates: "[]" }, user: { _id: oid() }, files: [] };
    const res = mockRes();

    await employeeUpdatePip(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("400s when goalUpdates is not valid JSON", async () => {
    const pip = { employeeId: { equals: vi.fn().mockReturnValue(true) } };
    Pip.findById.mockResolvedValue(pip);
    const req = {
      params: { id: oid() },
      body: { goalUpdates: "{not json" },
      user: { _id: oid() },
      files: [],
    };
    const res = mockRes();

    await employeeUpdatePip(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("updates goal progress, drops removed proof docs, uploads new files, and locks the PIP", async () => {
    const selfId = oid();
    const pipId = oid();
    const pip = {
      _id: pipId,
      employeeId: { equals: vi.fn().mockReturnValue(true) },
      employeeSubmitted: false,
      submittedManagerName: null,
      goals: [
        {
          title: "Improve turnaround",
          progressStatus: "not_started",
          proofDocuments: [{ blobName: "pips/old-doc.pdf", fileName: "old-doc.pdf" }],
        },
      ],
      save: vi.fn().mockResolvedValue(undefined),
    };
    Pip.findById.mockResolvedValue(pip);
    uploadAttachment.mockResolvedValue({ blobName: "pips/new-doc.pdf" });

    const goalUpdates = JSON.stringify([
      { index: 0, progressStatus: "on_track", removeProofPaths: ["pips/old-doc.pdf"] },
    ]);
    const file = { fieldname: "proof_0_0", originalname: "new-doc.pdf", mimetype: "application/pdf", buffer: Buffer.from("x") };
    const req = {
      params: { id: pipId },
      body: { goalUpdates, managerEmail: "manager@example.com" },
      user: { _id: selfId },
      files: [file],
    };
    const res = mockRes();

    await employeeUpdatePip(req, res);

    expect(pip.goals[0].progressStatus).toBe("on_track");
    expect(pip.goals[0].proofDocuments).toEqual([
      expect.objectContaining({ blobName: "pips/new-doc.pdf", fileName: "new-doc.pdf" }),
    ]);
    expect(uploadAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "new-doc.pdf", mimeType: "application/pdf", scope: "pips", parentId: pipId.toString() }),
    );
    expect(pip.employeeSubmitted).toBe(true);
    expect(pip.submittedManagerName).toBe("manager@example.com");
    expect(pip.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: "PIP updated", pip });
  });

  it("skips unknown goal indexes without throwing", async () => {
    const pip = {
      _id: oid(),
      employeeId: { equals: vi.fn().mockReturnValue(true) },
      goals: [],
      save: vi.fn().mockResolvedValue(undefined),
    };
    Pip.findById.mockResolvedValue(pip);
    const req = {
      params: { id: oid() },
      body: { goalUpdates: JSON.stringify([{ index: 5, progressStatus: "met" }]) },
      user: { _id: oid() },
      files: [],
    };
    const res = mockRes();

    await employeeUpdatePip(req, res);

    expect(uploadAttachment).not.toHaveBeenCalled();
    expect(pip.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: "PIP updated", pip });
  });

  // Fixed (doc §04 step 2 / §05 employeeSubmitted lock): employeeUpdatePip
  // now checks pip.employeeSubmitted before processing a new update.
  it("rejects a second goal-update submission while a prior one is still awaiting manager review", async () => {
    const pip = {
      _id: oid(),
      employeeId: { equals: vi.fn().mockReturnValue(true) },
      employeeSubmitted: true,
      goals: [{ title: "Goal", progressStatus: "on_track", proofDocuments: [] }],
      save: vi.fn().mockResolvedValue(undefined),
    };
    Pip.findById.mockResolvedValue(pip);
    const req = {
      params: { id: oid() },
      body: { goalUpdates: JSON.stringify([{ index: 0, progressStatus: "met" }]) },
      user: { _id: oid() },
      files: [],
    };
    const res = mockRes();

    await employeeUpdatePip(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(pip.save).not.toHaveBeenCalled();
  });

  // BUG (doc §07 "Employee submits a PIP goal update → manager"): no
  // notification is sent to the manager on submission — the handler only
  // stores req.body.managerEmail as free text (submittedManagerName), it
  // never looks up or notifies an actual manager user.
  it.todo("notifies the manager when the employee submits a goal update", async () => {
    const pip = {
      _id: oid(),
      employeeId: { equals: vi.fn().mockReturnValue(true) },
      goals: [],
      save: vi.fn().mockResolvedValue(undefined),
    };
    Pip.findById.mockResolvedValue(pip);
    const req = {
      params: { id: oid() },
      body: { goalUpdates: "[]", managerEmail: "manager@example.com" },
      user: { _id: oid() },
      files: [],
    };
    const res = mockRes();

    await employeeUpdatePip(req, res);

    expect(notifyUsers).toHaveBeenCalled();
  });

  // Fixed (doc §04 step 2: proof docs restricted to PDF/JPEG/PNG <=10MB):
  // employeeUpdatePip now validates mimetype before any upload happens.
  it("rejects a proof document whose mimetype is not PDF/JPEG/PNG", async () => {
    const pip = {
      _id: oid(),
      employeeId: { equals: vi.fn().mockReturnValue(true) },
      goals: [{ title: "Goal", progressStatus: "not_started", proofDocuments: [] }],
      save: vi.fn().mockResolvedValue(undefined),
    };
    Pip.findById.mockResolvedValue(pip);
    const file = { fieldname: "proof_0_0", originalname: "malware.exe", mimetype: "application/x-msdownload", buffer: Buffer.from("x") };
    const req = {
      params: { id: oid() },
      body: { goalUpdates: JSON.stringify([{ index: 0 }]) },
      user: { _id: oid() },
      files: [file],
    };
    const res = mockRes();

    await employeeUpdatePip(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(uploadAttachment).not.toHaveBeenCalled();
  });

  // Fixed: a fileFilter-equivalent check now rejects disallowed mimetypes
  // before any upload happens.
  it("400s and never uploads a disallowed mimetype", async () => {
    const pip = {
      _id: oid(),
      employeeId: { equals: vi.fn().mockReturnValue(true) },
      employeeSubmitted: false,
      goals: [{ title: "Goal", progressStatus: "not_started", proofDocuments: [] }],
      save: vi.fn().mockResolvedValue(undefined),
    };
    Pip.findById.mockResolvedValue(pip);
    const file = { fieldname: "proof_0_0", originalname: "malware.exe", mimetype: "application/x-msdownload", buffer: Buffer.from("x") };
    const req = {
      params: { id: oid() },
      body: { goalUpdates: JSON.stringify([{ index: 0 }]) },
      user: { _id: oid() },
      files: [file],
    };
    const res = mockRes();

    await employeeUpdatePip(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(uploadAttachment).not.toHaveBeenCalled();
    expect(pip.save).not.toHaveBeenCalled();
  });

  it("uploads an allowed mimetype (PDF/JPEG/PNG) successfully", async () => {
    const pip = {
      _id: oid(),
      employeeId: { equals: vi.fn().mockReturnValue(true) },
      employeeSubmitted: false,
      goals: [{ title: "Goal", progressStatus: "not_started", proofDocuments: [] }],
      save: vi.fn().mockResolvedValue(undefined),
    };
    Pip.findById.mockResolvedValue(pip);
    uploadAttachment.mockResolvedValue({ blobName: "pips/proof.pdf" });
    const file = { fieldname: "proof_0_0", originalname: "proof.pdf", mimetype: "application/pdf", buffer: Buffer.from("x") };
    const req = {
      params: { id: oid() },
      body: { goalUpdates: JSON.stringify([{ index: 0 }]) },
      user: { _id: oid() },
      files: [file],
    };
    const res = mockRes();

    await employeeUpdatePip(req, res);

    expect(uploadAttachment).toHaveBeenCalledWith(expect.objectContaining({ mimeType: "application/pdf" }));
    expect(res.status).not.toHaveBeenCalledWith(400);
  });
});
