import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Pip.js", () => ({
  default: { find: vi.fn(), findById: vi.fn(), create: vi.fn(), findByIdAndDelete: vi.fn() },
}));
// pipController.js has no notify/email import at all today — kept here so the
// intended-notification tests below (marked .todo) are ready to flip on the
// moment someone wires notifications up.
vi.mock("../utils/notify.js", () => ({ notifyUsers: vi.fn() }));

import Pip from "../models/Pip.js";
import { notifyUsers } from "../utils/notify.js";
import { listPips, getPip, createPip, updatePip, employeeSubmitPip, deletePip } from "./pipController.js";

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

describe("listPips", () => {
  it("lets a manager list all PIPs with no filter", async () => {
    const populate = vi.fn().mockResolvedValue([{ _id: oid() }]);
    Pip.find.mockReturnValue({ populate });
    const req = { query: {}, user: { _id: oid(), roles: { pms: "manager" } } };
    const res = mockRes();

    await listPips(req, res);

    expect(Pip.find).toHaveBeenCalledWith({});
    expect(populate).toHaveBeenCalledWith("employeeId", "name email");
    expect(res.json).toHaveBeenCalled();
  });

  it("applies employeeId and status query filters for HR", async () => {
    const populate = vi.fn().mockResolvedValue([]);
    Pip.find.mockReturnValue({ populate });
    const employeeId = oid().toString();
    const req = {
      query: { employeeId, status: "active" },
      user: { _id: oid(), roles: { pms: "hr" } },
    };
    const res = mockRes();

    await listPips(req, res);

    expect(Pip.find).toHaveBeenCalledWith({ employeeId, status: "active" });
  });

  it("forces the filter to the caller's own employeeId when the caller is an employee, ignoring any employeeId query param", async () => {
    const populate = vi.fn().mockResolvedValue([]);
    Pip.find.mockReturnValue({ populate });
    const selfId = oid();
    const someoneElseId = oid().toString();
    const req = {
      query: { employeeId: someoneElseId },
      user: { _id: selfId, roles: { pms: "employee" } },
    };
    const res = mockRes();

    await listPips(req, res);

    expect(Pip.find).toHaveBeenCalledWith({ employeeId: selfId });
  });
});

describe("getPip", () => {
  it("404s when the PIP doesn't exist", async () => {
    Pip.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(null) });
    const req = { params: { id: oid() }, user: { _id: oid(), roles: { pms: "hr" } } };
    const res = mockRes();

    await getPip(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403s an employee viewing someone else's PIP", async () => {
    const pip = { employeeId: oid() };
    pip.employeeId.equals = vi.fn().mockReturnValue(false);
    Pip.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(pip) });
    const req = { params: { id: oid() }, user: { _id: oid(), roles: { pms: "employee" } } };
    const res = mockRes();

    await getPip(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).not.toHaveBeenCalledWith(pip);
  });

  it("lets an employee view their own PIP", async () => {
    const selfId = oid();
    const pip = { employeeId: { equals: (id) => id.equals(selfId) } };
    // employeeId.equals is called as pip.employeeId.equals(req.user._id)
    pip.employeeId.equals = vi.fn().mockReturnValue(true);
    Pip.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(pip) });
    const req = { params: { id: oid() }, user: { _id: selfId, roles: { pms: "employee" } } };
    const res = mockRes();

    await getPip(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(pip);
  });

  it("lets a manager view any employee's PIP", async () => {
    const pip = { employeeId: { equals: vi.fn().mockReturnValue(false) } };
    Pip.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(pip) });
    const req = { params: { id: oid() }, user: { _id: oid(), roles: { pms: "manager" } } };
    const res = mockRes();

    await getPip(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(pip);
  });
});

describe("createPip", () => {
  it("403s an employee trying to open a PIP", async () => {
    const req = {
      body: { employeeId: oid(), startDate: "2026-01-01", targetEndDate: "2026-03-01" },
      user: { _id: oid(), roles: { pms: "employee" } },
    };
    const res = mockRes();

    await createPip(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Pip.create).not.toHaveBeenCalled();
  });

  it("400s when employeeId, startDate, or targetEndDate is missing", async () => {
    const req = {
      body: { startDate: "2026-01-01" },
      user: { _id: oid(), roles: { pms: "manager" } },
    };
    const res = mockRes();

    await createPip(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Pip.create).not.toHaveBeenCalled();
  });

  it("creates a PIP for a manager with the given reason and goals", async () => {
    const managerId = oid();
    const employeeId = oid();
    const created = { _id: oid() };
    Pip.create.mockResolvedValue(created);
    const goals = [{ title: "Improve code review turnaround", successMeasure: "PRs reviewed within 1 day" }];
    const req = {
      body: { employeeId, startDate: "2026-01-01", targetEndDate: "2026-03-01", reason: "Missed deadlines", goals },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await createPip(req, res);

    expect(Pip.create).toHaveBeenCalledWith({
      employeeId,
      startDate: "2026-01-01",
      targetEndDate: "2026-03-01",
      reason: "Missed deadlines",
      goals,
      createdBy: managerId,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
  });

  it("allows HR (not just manager) to create a PIP", async () => {
    Pip.create.mockResolvedValue({ _id: oid() });
    const req = {
      body: { employeeId: oid(), startDate: "2026-01-01", targetEndDate: "2026-03-01" },
      user: { _id: oid(), roles: { pms: "hr" } },
    };
    const res = mockRes();

    await createPip(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  // BUG (doc §07 "PIP created/updated → employee"): pipController.js's createPip
  // (src/controllers/pipController.js:30-46) never notifies the employee at all —
  // there is no notify/email import or call anywhere in this file. Left as .todo
  // to flag the gap rather than assert a call that will never happen.
  it.todo("notifies the employee when a PIP is created for them", async () => {
    Pip.create.mockResolvedValue({ _id: oid() });
    const employeeId = oid();
    const req = {
      body: { employeeId, startDate: "2026-01-01", targetEndDate: "2026-03-01" },
      user: { _id: oid(), roles: { pms: "manager" } },
    };
    const res = mockRes();

    await createPip(req, res);

    expect(notifyUsers).toHaveBeenCalledWith([employeeId], expect.objectContaining({ type: expect.any(String) }));
  });
});

describe("updatePip", () => {
  it("403s an employee trying to close out a PIP", async () => {
    const req = { params: { id: oid() }, body: { status: "completed" }, user: { _id: oid(), roles: { pms: "employee" } } };
    const res = mockRes();

    await updatePip(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Pip.findById).not.toHaveBeenCalled();
  });

  it("404s when the PIP doesn't exist", async () => {
    Pip.findById.mockResolvedValue(null);
    const req = { params: { id: oid() }, body: { status: "completed" }, user: { _id: oid(), roles: { pms: "hr" } } };
    const res = mockRes();

    await updatePip(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("lets a manager update status, outcome, reviewNotes, targetEndDate, and goals", async () => {
    const managerId = oid();
    const pip = {
      status: "active",
      outcome: null,
      reviewNotes: "",
      targetEndDate: "2026-03-01",
      goals: [{ title: "Old goal" }],
      save: vi.fn().mockResolvedValue(undefined),
    };
    Pip.findById.mockResolvedValue(pip);
    const newGoals = [{ title: "Revised goal" }];
    const req = {
      params: { id: oid() },
      body: { status: "extended", outcome: "extended", reviewNotes: "Needs more time", targetEndDate: "2026-04-01", goals: newGoals },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await updatePip(req, res);

    expect(pip.status).toBe("extended");
    expect(pip.outcome).toBe("extended");
    expect(pip.reviewNotes).toBe("Needs more time");
    expect(pip.targetEndDate).toBe("2026-04-01");
    expect(pip.goals).toBe(newGoals);
    expect(pip.updatedBy).toBe(managerId);
    expect(pip.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(pip);
  });

  it("leaves fields untouched when not provided in the body", async () => {
    const pip = {
      status: "active",
      outcome: null,
      reviewNotes: "original",
      targetEndDate: "2026-03-01",
      goals: [{ title: "Goal" }],
      save: vi.fn().mockResolvedValue(undefined),
    };
    Pip.findById.mockResolvedValue(pip);
    const req = { params: { id: oid() }, body: {}, user: { _id: oid(), roles: { pms: "hr" } } };
    const res = mockRes();

    await updatePip(req, res);

    expect(pip.status).toBe("active");
    expect(pip.reviewNotes).toBe("original");
  });

  // Fixed (doc §04 step 3 "Re-opens the employee's ability to submit another
  // update"): updatePip now resets pip.employeeSubmitted on close-out.
  it("resets employeeSubmitted to false when the manager closes out the review", async () => {
    const pip = {
      status: "active",
      employeeSubmitted: true,
      save: vi.fn().mockResolvedValue(undefined),
    };
    Pip.findById.mockResolvedValue(pip);
    const req = {
      params: { id: oid() },
      body: { status: "completed", outcome: "improved" },
      user: { _id: oid(), roles: { pms: "manager" } },
    };
    const res = mockRes();

    await updatePip(req, res);

    expect(pip.employeeSubmitted).toBe(false);
  });

  // BUG (doc §07): no notification is sent to the employee when their PIP is
  // updated/closed out — updatePip never imports or calls notifyUsers.
  it.todo("notifies the employee when their PIP is updated", async () => {
    const pip = { save: vi.fn().mockResolvedValue(undefined) };
    Pip.findById.mockResolvedValue(pip);
    const employeeId = oid();
    pip.employeeId = employeeId;
    const req = { params: { id: oid() }, body: { status: "completed" }, user: { _id: oid(), roles: { pms: "manager" } } };
    const res = mockRes();

    await updatePip(req, res);

    expect(notifyUsers).toHaveBeenCalledWith([employeeId], expect.objectContaining({ type: expect.any(String) }));
  });
});

describe("employeeSubmitPip", () => {
  it("404s when the PIP doesn't exist", async () => {
    Pip.findById.mockResolvedValue(null);
    const req = { params: { id: oid() }, body: {}, user: { _id: oid() } };
    const res = mockRes();

    await employeeSubmitPip(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403s an employee submitting goal updates for someone else's PIP", async () => {
    const pip = { employeeId: { equals: vi.fn().mockReturnValue(false) } };
    Pip.findById.mockResolvedValue(pip);
    const req = { params: { id: oid() }, body: { goals: [] }, user: { _id: oid() } };
    const res = mockRes();

    await employeeSubmitPip(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("lets the owning employee submit goal progress and locks the PIP", async () => {
    const selfId = oid();
    const pip = {
      employeeId: { equals: vi.fn().mockReturnValue(true) },
      employeeSubmitted: false,
      goals: [{ title: "Goal", progressStatus: "not_started" }],
      save: vi.fn().mockResolvedValue(undefined),
    };
    Pip.findById.mockResolvedValue(pip);
    const newGoals = [{ title: "Goal", progressStatus: "on_track" }];
    const req = { params: { id: oid() }, body: { goals: newGoals }, user: { _id: selfId } };
    const res = mockRes();

    await employeeSubmitPip(req, res);

    expect(pip.employeeSubmitted).toBe(true);
    expect(pip.goals).toBe(newGoals);
    expect(pip.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(pip);
  });

  // Fixed (doc §04 step 2 "Locked after submission until the manager reviews
  // it" / §05 employeeSubmitted lock): employeeSubmitPip now checks
  // pip.employeeSubmitted before processing a new update.
  it("rejects a second goal-update submission while a prior one is still awaiting manager review", async () => {
    const selfId = oid();
    const pip = {
      employeeId: { equals: vi.fn().mockReturnValue(true) },
      employeeSubmitted: true,
      goals: [{ title: "Goal", progressStatus: "on_track" }],
      save: vi.fn().mockResolvedValue(undefined),
    };
    Pip.findById.mockResolvedValue(pip);
    const req = { params: { id: oid() }, body: { goals: [{ title: "Goal", progressStatus: "met" }] }, user: { _id: selfId } };
    const res = mockRes();

    await employeeSubmitPip(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(pip.save).not.toHaveBeenCalled();
  });

  // BUG (doc §07 "Employee submits a PIP goal update → manager"): no
  // notification is sent to the manager on submission.
  it.todo("notifies the manager when the employee submits a goal update", async () => {
    const selfId = oid();
    const pip = {
      employeeId: { equals: vi.fn().mockReturnValue(true) },
      goals: [],
      save: vi.fn().mockResolvedValue(undefined),
    };
    Pip.findById.mockResolvedValue(pip);
    const req = { params: { id: oid() }, body: { goals: [] }, user: { _id: selfId } };
    const res = mockRes();

    await employeeSubmitPip(req, res);

    expect(notifyUsers).toHaveBeenCalled();
  });
});

describe("deletePip", () => {
  it("403s an employee trying to delete a PIP", async () => {
    const req = { params: { id: oid() }, user: { _id: oid(), roles: { pms: "employee" } } };
    const res = mockRes();

    await deletePip(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Pip.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it("404s when the PIP doesn't exist", async () => {
    Pip.findByIdAndDelete.mockResolvedValue(null);
    const req = { params: { id: oid() }, user: { _id: oid(), roles: { pms: "hr" } } };
    const res = mockRes();

    await deletePip(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("deletes the PIP for a manager/HR caller", async () => {
    const id = oid();
    Pip.findByIdAndDelete.mockResolvedValue({ _id: id });
    const req = { params: { id }, user: { _id: oid(), roles: { pms: "manager" } } };
    const res = mockRes();

    await deletePip(req, res);

    expect(Pip.findByIdAndDelete).toHaveBeenCalledWith(id);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
});
