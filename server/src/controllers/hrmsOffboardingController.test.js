import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Offboarding.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findById: vi.fn(), findOne: vi.fn() },
}));
vi.mock("../models/AssetAssignment.js", () => ({
  default: { countDocuments: vi.fn().mockResolvedValue(0), aggregate: vi.fn().mockResolvedValue([]) },
}));
vi.mock("../models/User.js", () => ({ default: { findById: vi.fn() } }));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("../utils/notify.js", () => ({ notifyUsers: vi.fn() }));
vi.mock("../utils/hrmsMailer.js", () => ({ sendHrmsEmail: vi.fn() }));

import Offboarding from "../models/Offboarding.js";
import AssetAssignment from "../models/AssetAssignment.js";
import User from "../models/User.js";
import { notifyUsers } from "../utils/notify.js";
import { sendHrmsEmail } from "../utils/hrmsMailer.js";
import {
  initiateOffboarding,
  listOffboarding,
  getMyOffboarding,
  recordExitInterview,
  processFinalSettlement,
} from "./hrmsOffboardingController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const makeDoc = (fields) => ({ ...fields, toObject: function () { return { ...this }; } });

const makeQuery = (result) => {
  const query = {};
  query.populate = vi.fn().mockReturnValue(query);
  query.sort = vi.fn().mockResolvedValue(result);
  query.then = (resolve) => resolve(result);
  return query;
};

const hrUser = () => ({ _id: oid(), roles: { hrms: "hr" } });
const makeSelectQuery = (result) => ({ select: vi.fn().mockResolvedValue(result) });

beforeEach(() => {
  vi.clearAllMocks();
  AssetAssignment.countDocuments.mockResolvedValue(0);
  AssetAssignment.aggregate.mockResolvedValue([]);
  User.findById.mockReturnValue(makeSelectQuery({ name: "Eve Employee", email: "eve@example.com" }));
});

describe("initiateOffboarding", () => {
  it("400s when required fields are missing", async () => {
    const req = { body: { employeeId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await initiateOffboarding(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Offboarding.create).not.toHaveBeenCalled();
  });

  it("404s an unknown employee", async () => {
    User.findById.mockReturnValue(makeSelectQuery(null));
    const req = { body: { employeeId: oid().toString(), resignationDate: "2026-08-01", lastWorkingDate: "2026-09-01" }, user: hrUser() };
    const res = mockRes();

    await initiateOffboarding(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(Offboarding.create).not.toHaveBeenCalled();
  });

  it("400s when lastWorkingDate is before resignationDate", async () => {
    const req = {
      body: { employeeId: oid().toString(), resignationDate: "2026-09-01", lastWorkingDate: "2026-08-01" },
      user: hrUser(),
    };
    const res = mockRes();

    await initiateOffboarding(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Offboarding.create).not.toHaveBeenCalled();
    expect(User.findById).not.toHaveBeenCalled();
  });

  it("allows lastWorkingDate equal to resignationDate", async () => {
    const employeeId = oid();
    User.findById.mockReturnValue(makeSelectQuery({ name: "Eve", email: "eve@example.com" }));
    Offboarding.create.mockResolvedValue({ _id: oid() });
    Offboarding.findById.mockReturnValue(makeQuery(makeDoc({ employee: { _id: employeeId } })));

    const req = {
      body: { employeeId: employeeId.toString(), resignationDate: "2026-08-01", lastWorkingDate: "2026-08-01" },
      user: hrUser(),
    };
    const res = mockRes();

    await initiateOffboarding(req, res);

    expect(Offboarding.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("409s when offboarding already exists for this employee", async () => {
    const error = new Error("dup");
    error.code = 11000;
    Offboarding.create.mockRejectedValue(error);

    const req = { body: { employeeId: oid().toString(), resignationDate: "2026-08-01", lastWorkingDate: "2026-09-01" }, user: hrUser() };
    const res = mockRes();

    await initiateOffboarding(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("creates a record, notifies, and emails the employee", async () => {
    const employeeId = oid();
    Offboarding.create.mockResolvedValue({ _id: oid() });
    Offboarding.findById.mockReturnValue(makeQuery(makeDoc({ employee: { _id: employeeId } })));

    const req = { body: { employeeId: employeeId.toString(), resignationDate: "2026-08-01", lastWorkingDate: "2026-09-01" }, user: hrUser() };
    const res = mockRes();

    await initiateOffboarding(req, res);

    expect(Offboarding.create).toHaveBeenCalledWith(expect.objectContaining({ employee: employeeId.toString() }));
    expect(notifyUsers).toHaveBeenCalledWith([employeeId.toString()], expect.objectContaining({ type: "offboardingInitiated" }));
    expect(sendHrmsEmail).toHaveBeenCalledWith("eve@example.com", expect.any(String), expect.any(String), expect.any(String));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("listOffboarding", () => {
  it("filters by status and attaches pendingAssetReturns via a single aggregate query", async () => {
    const employeeId = oid();
    Offboarding.find.mockReturnValue(makeQuery([makeDoc({ employee: { _id: employeeId } })]));
    AssetAssignment.aggregate.mockResolvedValue([{ _id: employeeId, count: 2 }]);

    const res = mockRes();
    await listOffboarding({ query: { status: "notice_period" }, user: hrUser() }, res);

    expect(Offboarding.find).toHaveBeenCalledWith({ status: "notice_period" });
    expect(AssetAssignment.aggregate).toHaveBeenCalledTimes(1);
    expect(AssetAssignment.countDocuments).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ pendingAssetReturns: 2 })]);
  });

  it("defaults pendingAssetReturns to 0 for an employee with no matching aggregate group", async () => {
    Offboarding.find.mockReturnValue(makeQuery([makeDoc({ employee: { _id: oid() } })]));
    AssetAssignment.aggregate.mockResolvedValue([]);

    const res = mockRes();
    await listOffboarding({ query: {}, user: hrUser() }, res);

    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ pendingAssetReturns: 0 })]);
  });

  it("returns an empty list without querying assets when there are no offboarding records", async () => {
    Offboarding.find.mockReturnValue(makeQuery([]));

    const res = mockRes();
    await listOffboarding({ query: {}, user: hrUser() }, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });
});

describe("getMyOffboarding", () => {
  it("404s when no record exists", async () => {
    Offboarding.findOne.mockReturnValue(makeQuery(null));
    const req = { user: { _id: oid() } };
    const res = mockRes();

    await getMyOffboarding(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("recordExitInterview", () => {
  it("404s when not found", async () => {
    Offboarding.findById.mockResolvedValue(null);
    const req = { params: { id: oid().toString() }, body: {}, user: hrUser() };
    const res = mockRes();

    await recordExitInterview(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("records the exit interview", async () => {
    const employeeId = oid();
    const offboarding = makeDoc({ _id: oid(), employee: employeeId, save: vi.fn().mockResolvedValue(undefined) });
    Offboarding.findById.mockResolvedValueOnce(offboarding).mockReturnValueOnce(makeQuery(makeDoc({ employee: { _id: employeeId } })));

    const req = { params: { id: offboarding._id.toString() }, body: { notes: "Good conversation" }, user: hrUser() };
    await recordExitInterview(req, mockRes());

    expect(offboarding.exitInterview.conducted).toBe(true);
    expect(offboarding.exitInterview.notes).toBe("Good conversation");
  });
});

describe("processFinalSettlement", () => {
  it("409s when the exit interview hasn't been conducted", async () => {
    Offboarding.findById.mockReturnValue(makeQuery(makeDoc({ _id: oid(), exitInterview: { conducted: false } })));
    const req = { params: { id: oid().toString() }, body: {}, user: hrUser() };
    const res = mockRes();

    await processFinalSettlement(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("409s when assets are still pending return", async () => {
    Offboarding.findById.mockReturnValue(makeQuery(makeDoc({ _id: oid(), employee: { _id: oid() }, exitInterview: { conducted: true } })));
    AssetAssignment.countDocuments.mockResolvedValue(1);

    const req = { params: { id: oid().toString() }, body: {}, user: hrUser() };
    const res = mockRes();

    await processFinalSettlement(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("clears the employee, notifies, and emails them once interview is done and assets are returned", async () => {
    const employeeId = oid();
    const offboarding = makeDoc({
      _id: oid(), employee: { _id: employeeId, name: "Eve Employee", email: "eve@example.com" }, exitInterview: { conducted: true },
      save: vi.fn().mockResolvedValue(undefined),
    });
    Offboarding.findById.mockReturnValueOnce(makeQuery(offboarding)).mockReturnValueOnce(makeQuery(makeDoc({ employee: { _id: employeeId } })));
    AssetAssignment.countDocuments.mockResolvedValue(0);

    const req = { params: { id: offboarding._id.toString() }, body: { notes: "All settled" }, user: hrUser() };
    await processFinalSettlement(req, mockRes());

    expect(offboarding.finalSettlement.processed).toBe(true);
    expect(offboarding.status).toBe("cleared");
    expect(notifyUsers).toHaveBeenCalledWith([employeeId], expect.objectContaining({ type: "offboardingSettled" }));
    expect(sendHrmsEmail).toHaveBeenCalledWith("eve@example.com", expect.any(String), expect.any(String), expect.any(String));
  });
});
