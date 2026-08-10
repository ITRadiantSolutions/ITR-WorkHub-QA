import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/JobRequest.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findById: vi.fn() },
}));
vi.mock("../models/JobPost.js", () => ({ default: { create: vi.fn() } }));
vi.mock("../models/User.js", () => ({ default: { find: vi.fn() } }));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("../utils/notify.js", () => ({ notifyUsers: vi.fn() }));

import JobRequest from "../models/JobRequest.js";
import JobPost from "../models/JobPost.js";
import User from "../models/User.js";
import { notifyUsers } from "../utils/notify.js";
import {
  createJobRequest,
  listJobRequests,
  updateJobRequest,
  reviewJobRequest,
  publishFromJobRequest,
} from "./hrmsJobRequestController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

const hrUser = (id = oid()) => ({ _id: id, name: "Helen HR", roles: { hrms: "hr" } });
const managerUser = (id = oid()) => ({ _id: id, name: "Mo Manager", roles: { hrms: "manager" } });
const employeeUser = (id = oid()) => ({ _id: id, name: "Eve Employee", roles: { hrms: "employee" } });

beforeEach(() => {
  vi.clearAllMocks();
  User.find.mockReturnValue({ select: vi.fn().mockResolvedValue([]) });
});

describe("createJobRequest", () => {
  it("400s when title is missing", async () => {
    const req = { body: {}, user: managerUser() };
    const res = mockRes();

    await createJobRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(JobRequest.create).not.toHaveBeenCalled();
  });

  it("creates a submitted request and notifies HR", async () => {
    const manager = managerUser();
    const created = { _id: oid(), title: "Senior Dev", status: "submitted" };
    JobRequest.create.mockResolvedValue(created);
    const hrIds = [oid()];
    User.find.mockReturnValue({ select: vi.fn().mockResolvedValue(hrIds.map((id) => ({ _id: id }))) });

    const req = { body: { title: "Senior Dev" }, user: manager };
    const res = mockRes();

    await createJobRequest(req, res);

    expect(JobRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Senior Dev", requestedBy: manager._id, status: "submitted" }),
    );
    expect(notifyUsers).toHaveBeenCalledWith(hrIds, expect.objectContaining({ type: "jobRequestSubmitted" }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

// Route-level enforcement lives in jobRequest.routes.js (allowRoles("hrms","manager")
// on POST /), so an employee never reaches this controller function for create —
// that's covered by the routing config, not re-tested here at the unit level.

describe("listJobRequests", () => {
  it("HR sees all requests (optionally filtered by status)", async () => {
    const sort = vi.fn().mockResolvedValue([]);
    const populate2 = vi.fn().mockReturnValue({ sort });
    const populate1 = vi.fn().mockReturnValue({ populate: populate2 });
    JobRequest.find.mockReturnValue({ populate: populate1 });

    const req = { query: { status: "submitted" }, user: hrUser() };
    const res = mockRes();

    await listJobRequests(req, res);

    expect(JobRequest.find).toHaveBeenCalledWith({ status: "submitted" });
  });

  it("a manager only sees their own requests, ignoring any status filter", async () => {
    const sort = vi.fn().mockResolvedValue([]);
    const populate2 = vi.fn().mockReturnValue({ sort });
    const populate1 = vi.fn().mockReturnValue({ populate: populate2 });
    JobRequest.find.mockReturnValue({ populate: populate1 });

    const manager = managerUser();
    const req = { query: { status: "submitted" }, user: manager };
    const res = mockRes();

    await listJobRequests(req, res);

    expect(JobRequest.find).toHaveBeenCalledWith({ requestedBy: manager._id });
  });
});

describe("updateJobRequest", () => {
  it("403s a manager editing someone else's request", async () => {
    JobRequest.findById.mockResolvedValue({ _id: oid(), requestedBy: oid(), status: "draft" });
    const req = { params: { id: oid().toString() }, body: { title: "x" }, user: managerUser() };
    const res = mockRes();

    await updateJobRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("409s editing a request that's already under_review", async () => {
    const manager = managerUser();
    JobRequest.findById.mockResolvedValue({ _id: oid(), requestedBy: manager._id, status: "under_review" });
    const req = { params: { id: oid().toString() }, body: { title: "x" }, user: manager };
    const res = mockRes();

    await updateJobRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe("reviewJobRequest", () => {
  it("403 not applicable here (route-gated) but 400s an invalid action value", async () => {
    JobRequest.findById.mockResolvedValue({ _id: oid(), status: "submitted" });
    const req = { params: { id: oid().toString() }, body: { action: "maybe" }, user: hrUser() };
    const res = mockRes();

    await reviewJobRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("409s reviewing a request that's already been decided", async () => {
    JobRequest.findById.mockResolvedValue({ _id: oid(), status: "approved" });
    const req = { params: { id: oid().toString() }, body: { action: "approve" }, user: hrUser() };
    const res = mockRes();

    await reviewJobRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("approves a submitted request and notifies the requesting manager", async () => {
    const requesterId = oid();
    const jobRequest = {
      _id: oid(), title: "Senior Dev", status: "submitted", requestedBy: requesterId,
      save: vi.fn().mockResolvedValue(undefined),
    };
    JobRequest.findById.mockResolvedValue(jobRequest);

    const hr = hrUser();
    const req = { params: { id: jobRequest._id.toString() }, body: { action: "approve" }, user: hr };
    const res = mockRes();

    await reviewJobRequest(req, res);

    expect(jobRequest.status).toBe("approved");
    expect(jobRequest.reviewedBy).toBe(hr._id);
    expect(notifyUsers).toHaveBeenCalledWith([requesterId], expect.objectContaining({ type: "jobRequestApproved" }));
  });
});

describe("publishFromJobRequest", () => {
  it("409s publishing a request that isn't approved", async () => {
    JobRequest.findById.mockResolvedValue({ _id: oid(), status: "submitted" });
    const req = { params: { id: oid().toString() }, body: {}, user: hrUser() };
    const res = mockRes();

    await publishFromJobRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(JobPost.create).not.toHaveBeenCalled();
  });

  it("creates a JobPost from an approved request and links it back", async () => {
    const jobRequest = {
      _id: oid(), title: "Senior Dev", status: "approved", department: "Eng",
      positions: 1, location: "Remote", employmentType: "Full-time",
      skillsRequired: [], skillsPreferred: [], priority: "Medium",
      save: vi.fn().mockResolvedValue(undefined),
    };
    JobRequest.findById.mockResolvedValue(jobRequest);
    const jobPost = { _id: oid() };
    JobPost.create.mockResolvedValue(jobPost);

    const hr = hrUser();
    const req = { params: { id: jobRequest._id.toString() }, body: {}, user: hr };
    const res = mockRes();

    await publishFromJobRequest(req, res);

    expect(JobPost.create).toHaveBeenCalledWith(expect.objectContaining({ status: "published", sourceJobRequest: jobRequest._id }));
    expect(jobRequest.status).toBe("published");
    expect(jobRequest.publishedJobPost).toBe(jobPost._id);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
