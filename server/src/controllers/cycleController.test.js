import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Cycle.js", () => ({
  default: { find: vi.fn(), findById: vi.fn(), create: vi.fn(), findByIdAndDelete: vi.fn(), updateMany: vi.fn() },
}));

import Cycle from "../models/Cycle.js";
import {
  listCycles,
  getCycle,
  createCycle,
  updateCycle,
  deleteCycle,
  setEmployeeResponseWindow,
  setManagerResponseWindow,
  setReportVisibility,
  disableExpiredCycles,
} from "./cycleController.js";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listCycles", () => {
  it("returns all cycles sorted by start desc, with no role restriction", async () => {
    const cycles = [{ name: "Q1" }, { name: "Q2" }];
    const sort = vi.fn().mockResolvedValue(cycles);
    Cycle.find.mockReturnValue({ sort });

    const req = { user: employeeUser() };
    const res = mockRes();

    await listCycles(req, res);

    expect(Cycle.find).toHaveBeenCalledWith({});
    expect(sort).toHaveBeenCalledWith({ start: -1 });
    expect(res.json).toHaveBeenCalledWith(cycles);
  });
});

describe("getCycle", () => {
  it("404s when the cycle doesn't exist", async () => {
    Cycle.findById.mockResolvedValue(null);
    const req = { params: { id: oid() }, user: employeeUser() };
    const res = mockRes();

    await getCycle(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Cycle not found" });
  });

  it("returns the cycle for any authenticated user (no HR gate)", async () => {
    const cycle = { _id: oid(), name: "Q1" };
    Cycle.findById.mockResolvedValue(cycle);
    const req = { params: { id: cycle._id }, user: employeeUser() };
    const res = mockRes();

    await getCycle(req, res);

    expect(res.json).toHaveBeenCalledWith(cycle);
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
    const req = { body: { name: "Q1" }, user: hrUser() };
    const res = mockRes();

    await createCycle(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Cycle.create).not.toHaveBeenCalled();
  });

  it("creates a cycle as HR with name/type/start/end and createdBy", async () => {
    const hrId = oid();
    const created = { _id: oid(), name: "Q1 2026" };
    Cycle.create.mockResolvedValue(created);
    const req = {
      body: { name: "Q1 2026", type: "quarterly", start: "2026-01-01", end: "2026-03-31" },
      user: hrUser(hrId),
    };
    const res = mockRes();

    await createCycle(req, res);

    expect(Cycle.create).toHaveBeenCalledWith({
      name: "Q1 2026",
      type: "quarterly",
      start: "2026-01-01",
      end: "2026-03-31",
      createdBy: hrId,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
  });
});

describe("updateCycle", () => {
  const buildCycle = (overrides = {}) => ({
    _id: oid(),
    name: "Old name",
    type: "quarterly",
    start: "2026-01-01",
    end: "2026-03-31",
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  it("403s a non-HR caller", async () => {
    const req = { params: { id: oid() }, body: { name: "New" }, user: employeeUser() };
    const res = mockRes();

    await updateCycle(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Cycle.findById).not.toHaveBeenCalled();
  });

  it("404s when the cycle doesn't exist", async () => {
    Cycle.findById.mockResolvedValue(null);
    const req = { params: { id: oid() }, body: { name: "New" }, user: hrUser() };
    const res = mockRes();

    await updateCycle(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updates only the fields provided, leaving others untouched", async () => {
    const cycle = buildCycle();
    Cycle.findById.mockResolvedValue(cycle);
    const req = { params: { id: cycle._id }, body: { name: "New name" }, user: hrUser() };
    const res = mockRes();

    await updateCycle(req, res);

    expect(cycle.name).toBe("New name");
    expect(cycle.type).toBe("quarterly");
    expect(cycle.start).toBe("2026-01-01");
    expect(cycle.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(cycle);
  });

  it("updates all provided fields together", async () => {
    const cycle = buildCycle();
    Cycle.findById.mockResolvedValue(cycle);
    const req = {
      params: { id: cycle._id },
      body: { name: "New", type: "annual", start: "2026-04-01", end: "2027-03-31" },
      user: hrUser(),
    };
    const res = mockRes();

    await updateCycle(req, res);

    expect(cycle.name).toBe("New");
    expect(cycle.type).toBe("annual");
    expect(cycle.start).toBe("2026-04-01");
    expect(cycle.end).toBe("2027-03-31");
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
    const cycle = { _id: oid() };
    Cycle.findByIdAndDelete.mockResolvedValue(cycle);
    const req = { params: { id: cycle._id }, user: hrUser() };
    const res = mockRes();

    await deleteCycle(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
  });
});

describe("setEmployeeResponseWindow / setManagerResponseWindow", () => {
  const buildCycle = () => ({
    _id: oid(),
    employeeResponse: { enabled: false, expiry: null, durationDays: null, selectedUserIds: [] },
    managerResponse: { enabled: false, expiry: null, durationDays: null, selectedUserIds: [] },
    save: vi.fn().mockResolvedValue(undefined),
  });

  it("403s a non-HR caller (employee window)", async () => {
    const req = { params: { id: oid() }, body: { enabled: true }, user: employeeUser() };
    const res = mockRes();

    await setEmployeeResponseWindow(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Cycle.findById).not.toHaveBeenCalled();
  });

  it("404s when the cycle doesn't exist (manager window)", async () => {
    Cycle.findById.mockResolvedValue(null);
    const req = { params: { id: oid() }, body: { enabled: true }, user: hrUser() };
    const res = mockRes();

    await setManagerResponseWindow(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("sets enabled, expiry, durationDays, and selectedUserIds on employeeResponse, leaving managerResponse untouched", async () => {
    const cycle = buildCycle();
    Cycle.findById.mockResolvedValue(cycle);
    const expiry = "2026-09-01T00:00:00.000Z";
    const selected = [oid(), oid()];
    const req = {
      params: { id: cycle._id },
      body: { enabled: true, expiry, durationDays: 7, selectedUserIds: selected },
      user: hrUser(),
    };
    const res = mockRes();

    await setEmployeeResponseWindow(req, res);

    expect(cycle.employeeResponse.enabled).toBe(true);
    expect(cycle.employeeResponse.expiry).toBe(expiry);
    expect(cycle.employeeResponse.durationDays).toBe(7);
    expect(cycle.employeeResponse.selectedUserIds).toBe(selected);
    expect(cycle.managerResponse.enabled).toBe(false);
    expect(cycle.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(cycle);
  });

  it("sets fields on managerResponse only, independent of employeeResponse", async () => {
    const cycle = buildCycle();
    Cycle.findById.mockResolvedValue(cycle);
    const req = {
      params: { id: cycle._id },
      body: { enabled: true, durationDays: 14 },
      user: hrUser(),
    };
    const res = mockRes();

    await setManagerResponseWindow(req, res);

    expect(cycle.managerResponse.enabled).toBe(true);
    expect(cycle.managerResponse.durationDays).toBe(14);
    expect(cycle.employeeResponse.enabled).toBe(false);
  });

  it("only touches fields explicitly present in the body (partial update)", async () => {
    const cycle = buildCycle();
    cycle.employeeResponse = { enabled: true, expiry: "2026-08-10", durationDays: 5, selectedUserIds: [oid()] };
    Cycle.findById.mockResolvedValue(cycle);
    const req = { params: { id: cycle._id }, body: { enabled: false }, user: hrUser() };
    const res = mockRes();

    await setEmployeeResponseWindow(req, res);

    expect(cycle.employeeResponse.enabled).toBe(false);
    expect(cycle.employeeResponse.expiry).toBe("2026-08-10");
    expect(cycle.employeeResponse.durationDays).toBe(5);
  });

  it("does not send any email/notification as a side effect (controller has no such wiring)", async () => {
    const cycle = buildCycle();
    Cycle.findById.mockResolvedValue(cycle);
    const req = {
      params: { id: cycle._id },
      body: { enabled: true, selectedUserIds: [oid()] },
      user: hrUser(),
    };
    const res = mockRes();

    // No mail/notify module is imported by cycleController.js at all, so there is
    // nothing to assert "was called" on — this test documents that opening the
    // response window here is a pure data write with no notification side effect,
    // contrary to the reference doc's §07 notification-map claim.
    await setEmployeeResponseWindow(req, res);

    expect(cycle.save).toHaveBeenCalledTimes(1);
  });
});

describe("setReportVisibility", () => {
  const buildCycle = () => ({
    _id: oid(),
    reportVisibility: { mode: "none", visibleTo: [], visibleToHistory: [] },
    save: vi.fn().mockResolvedValue(undefined),
  });

  it("403s a non-HR caller", async () => {
    const req = { params: { id: oid() }, body: { mode: "all" }, user: employeeUser() };
    const res = mockRes();

    await setReportVisibility(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Cycle.findById).not.toHaveBeenCalled();
  });

  it("404s when the cycle doesn't exist", async () => {
    Cycle.findById.mockResolvedValue(null);
    const req = { params: { id: oid() }, body: { mode: "all" }, user: hrUser() };
    const res = mockRes();

    await setReportVisibility(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("sets mode only, leaving visibleTo untouched, when visibleTo is omitted", async () => {
    const cycle = buildCycle();
    cycle.reportVisibility.visibleTo = [oid()];
    Cycle.findById.mockResolvedValue(cycle);
    const req = { params: { id: cycle._id }, body: { mode: "all" }, user: hrUser() };
    const res = mockRes();

    await setReportVisibility(req, res);

    expect(cycle.reportVisibility.mode).toBe("all");
    expect(cycle.reportVisibility.visibleTo).toHaveLength(1);
    expect(cycle.reportVisibility.visibleToHistory).toHaveLength(0);
  });

  it("sets visibleTo and appends every id (including duplicates) to visibleToHistory with a changedAt timestamp", async () => {
    const cycle = buildCycle();
    Cycle.findById.mockResolvedValue(cycle);
    const userA = oid();
    const userB = oid();
    const req = { params: { id: cycle._id }, body: { mode: "selected", visibleTo: [userA, userB] }, user: hrUser() };
    const res = mockRes();

    await setReportVisibility(req, res);

    expect(cycle.reportVisibility.mode).toBe("selected");
    expect(cycle.reportVisibility.visibleTo).toEqual([userA, userB]);
    expect(cycle.reportVisibility.visibleToHistory).toHaveLength(2);
    expect(cycle.reportVisibility.visibleToHistory[0]).toMatchObject({ userId: userA });
    expect(cycle.reportVisibility.visibleToHistory[0].changedAt).toBeInstanceOf(Date);
    expect(cycle.reportVisibility.visibleToHistory[1]).toMatchObject({ userId: userB });
  });

  it("accumulates visibleToHistory as a union across multiple grants, even when a user is later removed from visibleTo", async () => {
    const cycle = buildCycle();
    const userA = oid();
    const userB = oid();
    Cycle.findById.mockResolvedValue(cycle);
    const res = mockRes();

    // First grant: A and B.
    await setReportVisibility(
      { params: { id: cycle._id }, body: { mode: "selected", visibleTo: [userA, userB] }, user: hrUser() },
      res,
    );
    // Second grant: only A remains selected (B removed from current visibleTo).
    await setReportVisibility(
      { params: { id: cycle._id }, body: { visibleTo: [userA] }, user: hrUser() },
      res,
    );

    expect(cycle.reportVisibility.visibleTo).toEqual([userA]);
    // History still holds both grants for both users — a running union, not deduped.
    expect(cycle.reportVisibility.visibleToHistory).toHaveLength(3);
    const historyUserIds = cycle.reportVisibility.visibleToHistory.map((h) => h.userId);
    expect(historyUserIds).toEqual([userA, userB, userA]);
  });

  it("does not send any 'report available' email as a side effect (controller has no such wiring)", async () => {
    const cycle = buildCycle();
    Cycle.findById.mockResolvedValue(cycle);
    const req = { params: { id: cycle._id }, body: { mode: "all", visibleTo: [oid()] }, user: hrUser() };
    const res = mockRes();

    await setReportVisibility(req, res);

    expect(cycle.save).toHaveBeenCalledTimes(1);
  });
});

describe("disableExpiredCycles", () => {
  const REAL_DATE_NOW = Date.now;

  afterEach(() => {
    Date.now = REAL_DATE_NOW;
  });

  it("runs a conditional bulk update scoped to enabled+expired windows and returns matched/modified counts", async () => {
    Cycle.updateMany.mockResolvedValue({ matchedCount: 3, modifiedCount: 2 });

    const result = await disableExpiredCycles();

    expect(Cycle.updateMany).toHaveBeenCalledTimes(1);
    const [filter, pipeline] = Cycle.updateMany.mock.calls[0];
    expect(filter.$or).toEqual([
      { "employeeResponse.enabled": true, "employeeResponse.expiry": { $lt: expect.any(Date) } },
      { "managerResponse.enabled": true, "managerResponse.expiry": { $lt: expect.any(Date) } },
    ]);
    expect(Array.isArray(pipeline)).toBe(true);
    expect(result).toEqual({ matched: 3, modified: 2 });
  });

  it("does not send any expiry notification email (controller has no such wiring — pure DB update)", async () => {
    Cycle.updateMany.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });

    await disableExpiredCycles();

    expect(Cycle.updateMany).toHaveBeenCalledTimes(1);
  });
});
