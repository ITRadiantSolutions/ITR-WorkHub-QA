import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Cycle.js", () => ({
  default: { find: vi.fn(), findById: vi.fn(), create: vi.fn(), findByIdAndDelete: vi.fn() },
}));

import Cycle from "../models/Cycle.js";
import {
  listCycles,
  createCycle,
  updateCycle,
  deleteCycle,
  toggleResponse,
  updateReportVisibility,
  toggleUserReportAccess,
} from "./legacyCycleController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

const hrUser = (id = oid()) => ({ _id: id, roles: { pms: "hr" } });
const employeeUser = (id = oid()) => ({ _id: id, roles: { pms: "employee" } });

const buildCycle = (overrides = {}) => ({
  _id: oid(),
  name: "Q1 2026",
  type: "quarterly",
  start: "2026-01-01",
  end: "2026-03-31",
  employeeResponse: { enabled: false, expiry: null, durationDays: null, selectedUserIds: [] },
  managerResponse: { enabled: false, expiry: null, durationDays: null, selectedUserIds: [] },
  reportVisibility: { mode: "none", visibleTo: [], visibleToHistory: [] },
  save: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listCycles", () => {
  it("returns cycles flattened into the legacy shape", async () => {
    const cycle = buildCycle();
    cycle.employeeResponse.selectedUserIds = [oid()];
    const sort = vi.fn().mockResolvedValue([cycle]);
    Cycle.find.mockReturnValue({ sort });

    const req = { user: employeeUser() };
    const res = mockRes();

    await listCycles(req, res);

    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({
        id: cycle._id,
        _id: cycle._id,
        name: "Q1 2026",
        employeeResponseEnabled: false,
        reportVisibility: "none",
        selectedEmployees: cycle.employeeResponse.selectedUserIds,
      }),
    ]);
  });
});

describe("createCycle", () => {
  it("403s a non-HR caller", async () => {
    const req = { body: { name: "Q1", start: "2026-01-01", end: "2026-03-31" }, user: employeeUser() };
    const res = mockRes();

    await createCycle(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Cycle.create).not.toHaveBeenCalled();
  });

  it("400s when name, start, or end is missing", async () => {
    const req = { body: { start: "2026-01-01", end: "2026-03-31" }, user: hrUser() };
    const res = mockRes();

    await createCycle(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Cycle.create).not.toHaveBeenCalled();
  });

  it("creates a cycle and returns it in legacy (flat) shape with 201", async () => {
    const hrId = oid();
    const created = buildCycle({ name: "New cycle" });
    Cycle.create.mockResolvedValue(created);
    const req = {
      body: { name: "New cycle", type: "annual", start: "2026-01-01", end: "2026-12-31" },
      user: hrUser(hrId),
    };
    const res = mockRes();

    await createCycle(req, res);

    expect(Cycle.create).toHaveBeenCalledWith({
      name: "New cycle",
      type: "annual",
      start: "2026-01-01",
      end: "2026-12-31",
      createdBy: hrId,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ name: "New cycle", id: created._id }));
  });
});

describe("updateCycle", () => {
  it("403s a non-HR caller", async () => {
    const req = { params: { id: oid() }, body: { name: "New" }, user: employeeUser() };
    const res = mockRes();

    await updateCycle(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("404s when the cycle doesn't exist", async () => {
    Cycle.findById.mockResolvedValue(null);
    const req = { params: { id: oid() }, body: { name: "New" }, user: hrUser() };
    const res = mockRes();

    await updateCycle(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updates provided fields and returns the legacy shape", async () => {
    const cycle = buildCycle();
    Cycle.findById.mockResolvedValue(cycle);
    const req = { params: { id: cycle._id }, body: { name: "Renamed" }, user: hrUser() };
    const res = mockRes();

    await updateCycle(req, res);

    expect(cycle.name).toBe("Renamed");
    expect(cycle.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ name: "Renamed" }));
  });
});

describe("deleteCycle", () => {
  it("403s a non-HR caller", async () => {
    const req = { params: { id: oid() }, user: employeeUser() };
    const res = mockRes();

    await deleteCycle(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Cycle.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it("404s when the cycle doesn't exist", async () => {
    Cycle.findByIdAndDelete.mockResolvedValue(null);
    const req = { params: { id: oid() }, user: hrUser() };
    const res = mockRes();

    await deleteCycle(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("deletes and returns 204 with no body", async () => {
    Cycle.findByIdAndDelete.mockResolvedValue(buildCycle());
    const req = { params: { id: oid() }, user: hrUser() };
    const res = mockRes();

    await deleteCycle(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
  });
});

describe("toggleResponse", () => {
  it("400s on a role outside employee/manager", async () => {
    const req = { params: { id: oid() }, body: { role: "admin", enabled: true }, user: hrUser() };
    const res = mockRes();

    await toggleResponse(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Cycle.findById).not.toHaveBeenCalled();
  });

  it("403s a non-HR caller", async () => {
    const req = { params: { id: oid() }, body: { role: "employee", enabled: true }, user: employeeUser() };
    const res = mockRes();

    await toggleResponse(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("404s when the cycle doesn't exist", async () => {
    Cycle.findById.mockResolvedValue(null);
    const req = { params: { id: oid() }, body: { role: "employee", enabled: true }, user: hrUser() };
    const res = mockRes();

    await toggleResponse(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("opens a fresh employee window: sets enabled, durationDays, computed expiry, and selectedUserIds", async () => {
    const cycle = buildCycle();
    Cycle.findById.mockResolvedValue(cycle);
    const selected = [oid(), oid()];
    const req = {
      params: { id: cycle._id },
      body: { role: "employee", enabled: true, durationDays: 5, selectedUsers: selected },
      user: hrUser(),
    };
    const res = mockRes();

    const before = Date.now();
    await toggleResponse(req, res);
    const after = Date.now();

    expect(cycle.employeeResponse.enabled).toBe(true);
    expect(cycle.employeeResponse.durationDays).toBe(5);
    const expiryMs = new Date(cycle.employeeResponse.expiry).getTime();
    expect(expiryMs).toBeGreaterThanOrEqual(before + 5 * 24 * 60 * 60 * 1000);
    expect(expiryMs).toBeLessThanOrEqual(after + 5 * 24 * 60 * 60 * 1000);
    expect(cycle.employeeResponse.selectedUserIds).toBe(selected);
    expect(cycle.managerResponse.enabled).toBe(false);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ employeeResponseEnabled: true }));
  });

  it("extends an already-open manager window by extraDays instead of recomputing from durationDays", async () => {
    const originalExpiry = new Date("2026-08-10T00:00:00.000Z");
    const cycle = buildCycle({
      managerResponse: { enabled: true, expiry: originalExpiry, durationDays: 7, selectedUserIds: [] },
    });
    Cycle.findById.mockResolvedValue(cycle);
    const req = {
      params: { id: cycle._id },
      body: { role: "manager", enabled: true, extraDays: 3, durationDays: 30 },
      user: hrUser(),
    };
    const res = mockRes();

    await toggleResponse(req, res);

    const expected = new Date(originalExpiry.getTime() + 3 * 24 * 60 * 60 * 1000);
    expect(cycle.managerResponse.expiry.getTime()).toBe(expected.getTime());
    // durationDays param is ignored on this branch — the stored durationDays is untouched.
    expect(cycle.managerResponse.durationDays).toBe(7);
  });

  it("disabling a window (enabled: false) only flips the flag and leaves expiry/durationDays/selectedUserIds untouched", async () => {
    const expiry = new Date("2026-08-10");
    const selected = [oid()];
    const cycle = buildCycle({
      employeeResponse: { enabled: true, expiry, durationDays: 7, selectedUserIds: selected },
    });
    Cycle.findById.mockResolvedValue(cycle);
    const req = {
      params: { id: cycle._id },
      body: { role: "employee", enabled: false, durationDays: 99, selectedUsers: [oid()] },
      user: hrUser(),
    };
    const res = mockRes();

    await toggleResponse(req, res);

    expect(cycle.employeeResponse.enabled).toBe(false);
    expect(cycle.employeeResponse.expiry).toBe(expiry);
    expect(cycle.employeeResponse.durationDays).toBe(7);
    expect(cycle.employeeResponse.selectedUserIds).toBe(selected);
  });

  it("does not send any 'window opened' email despite the reference doc's claim that both roles are notified", async () => {
    const cycle = buildCycle();
    Cycle.findById.mockResolvedValue(cycle);
    const req = {
      params: { id: cycle._id },
      body: { role: "employee", enabled: true, durationDays: 5, selectedUsers: [oid()] },
      user: hrUser(),
    };
    const res = mockRes();

    // legacyCycleController.js imports nothing mail/notify-related — this test
    // documents that opening the window is a pure data write.
    await toggleResponse(req, res);

    expect(cycle.save).toHaveBeenCalledTimes(1);
  });
});

describe("updateReportVisibility", () => {
  it("403s a non-HR caller", async () => {
    const req = { params: { id: oid() }, body: { reportVisibility: "all" }, user: employeeUser() };
    const res = mockRes();

    await updateReportVisibility(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("404s when the cycle doesn't exist", async () => {
    Cycle.findById.mockResolvedValue(null);
    const req = { params: { id: oid() }, body: { reportVisibility: "all" }, user: hrUser() };
    const res = mockRes();

    await updateReportVisibility(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("sets mode and ignores a non-array selectedUsers", async () => {
    const cycle = buildCycle();
    cycle.reportVisibility.visibleTo = [oid()];
    Cycle.findById.mockResolvedValue(cycle);
    const req = {
      params: { id: cycle._id },
      body: { reportVisibility: "all", selectedUsers: "not-an-array" },
      user: hrUser(),
    };
    const res = mockRes();

    await updateReportVisibility(req, res);

    expect(cycle.reportVisibility.mode).toBe("all");
    expect(cycle.reportVisibility.visibleTo).toHaveLength(1);
    expect(cycle.reportVisibility.visibleToHistory).toHaveLength(0);
  });

  it("accumulates visibleToHistory as a union across two grants, matching cycleController's behavior", async () => {
    const cycle = buildCycle();
    Cycle.findById.mockResolvedValue(cycle);
    const userA = oid();
    const userB = oid();
    const res = mockRes();

    await updateReportVisibility(
      { params: { id: cycle._id }, body: { reportVisibility: "selected", selectedUsers: [userA] }, user: hrUser() },
      res,
    );
    await updateReportVisibility(
      { params: { id: cycle._id }, body: { selectedUsers: [userA, userB] }, user: hrUser() },
      res,
    );

    expect(cycle.reportVisibility.visibleTo).toEqual([userA, userB]);
    expect(cycle.reportVisibility.visibleToHistory).toHaveLength(3);
    expect(cycle.reportVisibility.visibleToHistory.map((h) => h.userId)).toEqual([userA, userA, userB]);
  });

  it("does not send any 'report available' email despite the reference doc's claim", async () => {
    const cycle = buildCycle();
    Cycle.findById.mockResolvedValue(cycle);
    const req = {
      params: { id: cycle._id },
      body: { reportVisibility: "all", selectedUsers: [oid()] },
      user: hrUser(),
    };
    const res = mockRes();

    await updateReportVisibility(req, res);

    expect(cycle.save).toHaveBeenCalledTimes(1);
  });
});

describe("toggleUserReportAccess", () => {
  it("403s a non-HR caller", async () => {
    const req = { params: { id: oid() }, body: { userId: oid().toString() }, user: employeeUser() };
    const res = mockRes();

    await toggleUserReportAccess(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("404s when the cycle doesn't exist", async () => {
    Cycle.findById.mockResolvedValue(null);
    const req = { params: { id: oid() }, body: { userId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await toggleUserReportAccess(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("grants access (adds to visibleTo) and logs it in visibleToHistory when the user isn't currently listed", async () => {
    const cycle = buildCycle();
    Cycle.findById.mockResolvedValue(cycle);
    const userId = oid().toString();
    const req = { params: { id: cycle._id }, body: { userId }, user: hrUser() };
    const res = mockRes();

    await toggleUserReportAccess(req, res);

    expect(cycle.reportVisibility.visibleTo).toEqual([userId]);
    expect(cycle.reportVisibility.visibleToHistory).toHaveLength(1);
    expect(cycle.reportVisibility.visibleToHistory[0]).toMatchObject({ userId });
  });

  it("revokes access (removes from visibleTo) but still appends to visibleToHistory when the user is currently listed", async () => {
    const userId = oid();
    const cycle = buildCycle();
    cycle.reportVisibility.visibleTo = [userId];
    Cycle.findById.mockResolvedValue(cycle);
    const req = { params: { id: cycle._id }, body: { userId: userId.toString() }, user: hrUser() };
    const res = mockRes();

    await toggleUserReportAccess(req, res);

    expect(cycle.reportVisibility.visibleTo).toHaveLength(0);
    expect(cycle.reportVisibility.visibleToHistory).toHaveLength(1);
    expect(cycle.reportVisibility.visibleToHistory[0]).toMatchObject({ userId: userId.toString() });
  });
});
