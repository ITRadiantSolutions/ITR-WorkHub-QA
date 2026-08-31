import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/HrRequest.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findById: vi.fn() },
  HR_REQUEST_TYPES: ["salary_certificate", "experience_letter", "document_request", "profile_change", "bank_change", "query"],
}));
vi.mock("../models/User.js", () => ({ default: { find: vi.fn(), findOne: vi.fn() } }));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("../utils/notify.js", () => ({ notifyUsers: vi.fn() }));
vi.mock("../utils/hrmsMailer.js", () => ({ sendHrmsEmail: vi.fn() }));

import HrRequest from "../models/HrRequest.js";
import User from "../models/User.js";
import { notifyUsers } from "../utils/notify.js";
import { sendHrmsEmail } from "../utils/hrmsMailer.js";
import { createHrRequest, listMyHrRequests, listHrRequests, assignHrRequest, resolveHrRequest } from "./hrmsHrRequestController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const makeQuery = (result) => {
  const query = {};
  query.populate = vi.fn().mockReturnValue(query);
  query.sort = vi.fn().mockResolvedValue(result);
  query.then = (resolve) => resolve(result);
  return query;
};

const employeeUser = () => ({ _id: oid(), name: "Eve Employee", roles: { hrms: "employee" } });
const hrUser = () => ({ _id: oid(), name: "Helen HR", roles: { hrms: "hr" } });

beforeEach(() => {
  vi.clearAllMocks();
  User.find.mockReturnValue({ select: vi.fn().mockResolvedValue([]) });
  User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: oid() }) });
});

describe("createHrRequest", () => {
  it("400s an invalid type", async () => {
    const req = { body: { type: "not-a-type", subject: "x" }, user: employeeUser() };
    const res = mockRes();

    await createHrRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(HrRequest.create).not.toHaveBeenCalled();
  });

  it("400s a missing subject", async () => {
    const req = { body: { type: "query" }, user: employeeUser() };
    const res = mockRes();

    await createHrRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("creates a request, notifies HR, and emails them", async () => {
    const employee = employeeUser();
    HrRequest.create.mockResolvedValue({ _id: oid() });
    HrRequest.findById.mockReturnValue(makeQuery({ _id: oid() }));
    const hrId = oid();
    User.find.mockReturnValue({ select: vi.fn().mockResolvedValue([{ _id: hrId, email: "helen@example.com" }]) });

    const req = { body: { type: "salary_certificate", subject: "Need a salary certificate" }, user: employee };
    const res = mockRes();

    await createHrRequest(req, res);

    expect(HrRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ requestedBy: employee._id, type: "salary_certificate" }),
    );
    expect(notifyUsers).toHaveBeenCalledWith([hrId], expect.objectContaining({ type: "hrRequestSubmitted" }));
    expect(sendHrmsEmail).toHaveBeenCalledWith("helen@example.com", expect.any(String), expect.any(String), expect.any(String));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("listMyHrRequests", () => {
  it("scopes to the caller", async () => {
    const employee = employeeUser();
    HrRequest.find.mockReturnValue(makeQuery([]));

    await listMyHrRequests({ query: {}, user: employee }, mockRes());

    expect(HrRequest.find).toHaveBeenCalledWith({ requestedBy: employee._id });
  });
});

describe("listHrRequests", () => {
  it("filters by status/type/assignedTo when given", async () => {
    HrRequest.find.mockReturnValue(makeQuery([]));
    const assignee = oid().toString();

    await listHrRequests({ query: { status: "open", type: "query", assignedTo: assignee }, user: hrUser() }, mockRes());

    expect(HrRequest.find).toHaveBeenCalledWith({ status: "open", type: "query", assignedTo: assignee });
  });
});

describe("assignHrRequest", () => {
  it("404s when not found", async () => {
    HrRequest.findById.mockResolvedValueOnce(null);
    const req = { params: { id: oid().toString() }, body: {}, user: hrUser() };
    const res = mockRes();

    await assignHrRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("409s reassigning an already-resolved request", async () => {
    HrRequest.findById.mockResolvedValueOnce({ _id: oid(), status: "resolved" });
    const req = { params: { id: oid().toString() }, body: {}, user: hrUser() };
    const res = mockRes();

    await assignHrRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("assigns and moves an open request to in_progress", async () => {
    const doc = { _id: oid(), status: "open", assignedTo: null, save: vi.fn().mockResolvedValue(undefined) };
    HrRequest.findById.mockResolvedValueOnce(doc).mockReturnValueOnce(makeQuery({ ...doc, status: "in_progress" }));

    const hr = hrUser();
    const assigneeId = oid();
    const req = { params: { id: doc._id.toString() }, body: { assignedTo: assigneeId }, user: hr };
    await assignHrRequest(req, mockRes());

    expect(User.findOne).toHaveBeenCalledWith({ _id: assigneeId, "roles.hrms": "hr" });
    expect(doc.assignedTo).toBe(assigneeId);
    expect(doc.status).toBe("in_progress");
  });

  it("400s when assignedTo isn't an existing HR user", async () => {
    const doc = { _id: oid(), status: "open", assignedTo: null, save: vi.fn().mockResolvedValue(undefined) };
    HrRequest.findById.mockResolvedValueOnce(doc);
    User.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });

    const req = { params: { id: doc._id.toString() }, body: { assignedTo: oid() }, user: hrUser() };
    const res = mockRes();
    await assignHrRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(doc.save).not.toHaveBeenCalled();
  });

  it("skips the assignee check when self-assigning (assignedTo omitted)", async () => {
    const doc = { _id: oid(), status: "open", assignedTo: null, save: vi.fn().mockResolvedValue(undefined) };
    HrRequest.findById.mockResolvedValueOnce(doc).mockReturnValueOnce(makeQuery({ ...doc, status: "in_progress" }));
    const hr = hrUser();

    const req = { params: { id: doc._id.toString() }, body: {}, user: hr };
    await assignHrRequest(req, mockRes());

    expect(User.findOne).not.toHaveBeenCalled();
    expect(doc.assignedTo).toBe(hr._id);
  });
});

describe("resolveHrRequest", () => {
  it("409s resolving an already-resolved request", async () => {
    HrRequest.findById.mockReturnValueOnce(makeQuery({ _id: oid(), status: "resolved" }));
    const req = { params: { id: oid().toString() }, body: {}, user: hrUser() };
    const res = mockRes();

    await resolveHrRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("resolves, notifies, and emails the requester", async () => {
    const requesterId = oid();
    const doc = {
      _id: oid(), status: "in_progress", requestedBy: { _id: requesterId, email: "eve@example.com" },
      subject: "Salary certificate", save: vi.fn().mockResolvedValue(undefined),
    };
    HrRequest.findById.mockReturnValueOnce(makeQuery(doc)).mockReturnValueOnce(makeQuery({ ...doc, status: "resolved" }));

    const req = { params: { id: doc._id.toString() }, body: { resolutionNote: "Emailed" }, user: hrUser() };
    await resolveHrRequest(req, mockRes());

    expect(doc.status).toBe("resolved");
    expect(doc.resolutionNote).toBe("Emailed");
    expect(notifyUsers).toHaveBeenCalledWith([requesterId], expect.objectContaining({ type: "hrRequestResolved" }));
    expect(sendHrmsEmail).toHaveBeenCalledWith("eve@example.com", expect.any(String), expect.any(String), expect.any(String));
  });
});
