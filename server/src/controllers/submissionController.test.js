import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Submission.js", () => ({
  default: { find: vi.fn(), findById: vi.fn(), findOne: vi.fn(), create: vi.fn() },
}));
vi.mock("../models/KraAssignment.js", () => ({ default: { findById: vi.fn() } }));
vi.mock("../models/User.js", () => ({ default: { findById: vi.fn(), find: vi.fn() } }));
vi.mock("../models/Cycle.js", () => ({ default: { findById: vi.fn() } }));
vi.mock("../utils/notify.js", () => ({ notifyUsers: vi.fn() }));

import Submission from "../models/Submission.js";
import KraAssignment from "../models/KraAssignment.js";
import User from "../models/User.js";
import Cycle from "../models/Cycle.js";
import { notifyUsers } from "../utils/notify.js";
import {
  listSubmissions,
  getSubmission,
  getOrCreateFromAssignment,
  saveResponses,
  employeeSubmit,
  managerReview,
  setFinalReport,
} from "./submissionController.js";

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

// saveResponses/employeeSubmit both check the cycle's employeeResponse
// window server-side — most tests here are exercising other behavior, so
// they need the window mocked open for their employeeId by default.
const mockOpenWindow = (employeeId) =>
  Cycle.findById.mockReturnValue({
    select: vi.fn().mockResolvedValue({ employeeResponse: { enabled: true, expiry: null, selectedUserIds: [employeeId] } }),
  });
const mockClosedWindow = () =>
  Cycle.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ employeeResponse: { enabled: false, selectedUserIds: [] } }) });

// ---------------------------------------------------------------------------
// listSubmissions
// ---------------------------------------------------------------------------
describe("listSubmissions", () => {
  const setupFind = () => {
    const populate = vi.fn().mockResolvedValue([{ _id: oid() }]);
    Submission.find.mockReturnValue({ populate });
    return populate;
  };

  it("HR: scopes by employeeId only when explicitly requested, otherwise sees all", async () => {
    setupFind();
    const employeeId = oid();
    const req = { query: { employeeId }, user: { _id: oid(), roles: { pms: "hr" } } };
    const res = mockRes();

    await listSubmissions(req, res);

    expect(Submission.find).toHaveBeenCalledWith({ employeeId });
  });

  it("HR: no employeeId filter when not requested", async () => {
    setupFind();
    const req = { query: {}, user: { _id: oid(), roles: { pms: "hr" } } };
    const res = mockRes();

    await listSubmissions(req, res);

    expect(Submission.find).toHaveBeenCalledWith({});
  });

  it("Manager: scoped to own reports (managerId) plus current direct reports, ignoring an employeeId query param", async () => {
    setupFind();
    const managerId = oid();
    const directReportId = oid();
    User.find.mockReturnValue({ select: vi.fn().mockResolvedValue([{ _id: directReportId }]) });
    const req = {
      query: { employeeId: oid() },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await listSubmissions(req, res);

    expect(User.find).toHaveBeenCalledWith({ managerId });
    expect(Submission.find).toHaveBeenCalledWith({
      $or: [{ managerId }, { employeeId: { $in: [directReportId] } }],
    });
  });

  it("Employee: always scoped to their own submissions", async () => {
    setupFind();
    const employeeId = oid();
    const req = { query: {}, user: { _id: employeeId, roles: { pms: "employee" } } };
    const res = mockRes();

    await listSubmissions(req, res);

    expect(Submission.find).toHaveBeenCalledWith({ employeeId });
  });

  it("applies cycleId filter for any role", async () => {
    setupFind();
    const cycleId = oid();
    const employeeId = oid();
    const req = { query: { cycleId }, user: { _id: employeeId, roles: { pms: "employee" } } };
    const res = mockRes();

    await listSubmissions(req, res);

    expect(Submission.find).toHaveBeenCalledWith({ cycleId, employeeId });
  });

  it("populates employeeId name/email and managerId name, and returns the result", async () => {
    const populate = setupFind();
    const req = { query: {}, user: { _id: oid(), roles: { pms: "hr" } } };
    const res = mockRes();

    await listSubmissions(req, res);

    expect(populate).toHaveBeenCalledWith([
      { path: "employeeId", select: "name email" },
      { path: "managerId", select: "name" },
    ]);
    expect(res.json).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getSubmission
// ---------------------------------------------------------------------------
describe("getSubmission", () => {
  const setupFindById = (doc) => {
    const populate = vi.fn().mockResolvedValue(doc);
    Submission.findById.mockReturnValue({ populate });
  };

  it("404s when the submission doesn't exist", async () => {
    setupFindById(null);
    const req = { params: { id: oid() }, user: { _id: oid(), roles: { pms: "employee" } } };
    const res = mockRes();

    await getSubmission(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403s a caller who is neither the employee, the assigned manager, nor HR", async () => {
    const submission = { employeeId: oid(), managerId: oid() };
    setupFindById(submission);
    const req = { params: { id: oid() }, user: { _id: oid(), roles: { pms: "employee" } } };
    const res = mockRes();

    await getSubmission(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows the owning employee to view", async () => {
    const employeeId = oid();
    const submission = { employeeId, managerId: oid() };
    setupFindById(submission);
    const req = { params: { id: oid() }, user: { _id: employeeId, roles: { pms: "employee" } } };
    const res = mockRes();

    await getSubmission(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(submission);
  });

  it("allows the assigned manager to view", async () => {
    const managerId = oid();
    const submission = { employeeId: oid(), managerId };
    setupFindById(submission);
    const req = { params: { id: oid() }, user: { _id: managerId, roles: { pms: "manager" } } };
    const res = mockRes();

    await getSubmission(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(submission);
  });

  it("403s a manager who is not the assigned manager for this submission and is not the employee's current manager either", async () => {
    const submission = { employeeId: oid(), managerId: oid() };
    setupFindById(submission);
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ managerId: oid() }) });
    const req = { params: { id: oid() }, user: { _id: oid(), roles: { pms: "manager" } } };
    const res = mockRes();

    await getSubmission(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows a manager who isn't the frozen submission.managerId but is the employee's current manager (reassignment case)", async () => {
    const currentManagerId = oid();
    const submission = { employeeId: oid(), managerId: oid() };
    setupFindById(submission);
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ managerId: currentManagerId }) });
    const req = { params: { id: oid() }, user: { _id: currentManagerId, roles: { pms: "manager" } } };
    const res = mockRes();

    await getSubmission(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(submission);
  });

  it("allows HR to view any submission", async () => {
    const submission = { employeeId: oid(), managerId: oid() };
    setupFindById(submission);
    const req = { params: { id: oid() }, user: { _id: oid(), roles: { pms: "hr" } } };
    const res = mockRes();

    await getSubmission(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(submission);
  });
});

// ---------------------------------------------------------------------------
// getOrCreateFromAssignment
// ---------------------------------------------------------------------------
describe("getOrCreateFromAssignment", () => {
  const buildAssignment = ({ assignedTo, cycleId = oid() }) => ({
    _id: oid(),
    cycleId,
    assignedTo,
    kras: [
      { _id: oid(), name: "Ship features", weight: 60, kpis: [{ title: "KPI 1" }] },
      { _id: oid(), name: "Mentor juniors", weight: 40, kpis: [] },
    ],
  });

  it("404s when the assignment doesn't exist", async () => {
    KraAssignment.findById.mockResolvedValue(null);
    const req = { params: { assignmentId: oid() }, body: {}, user: { _id: oid(), roles: { pms: "employee" } } };
    const res = mockRes();

    await getOrCreateFromAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403s a caller who is not the assignee and not HR", async () => {
    const assignment = buildAssignment({ assignedTo: oid() });
    KraAssignment.findById.mockResolvedValue(assignment);
    const req = {
      params: { assignmentId: assignment._id },
      body: {},
      user: { _id: oid(), roles: { pms: "employee" } },
    };
    const res = mockRes();

    await getOrCreateFromAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows HR to open another employee's assignment", async () => {
    const assignment = buildAssignment({ assignedTo: oid() });
    KraAssignment.findById.mockResolvedValue(assignment);
    Submission.findOne.mockResolvedValue({ _id: oid(), populate: vi.fn().mockResolvedValue() });
    const req = {
      params: { assignmentId: assignment._id },
      body: {},
      user: { _id: oid(), roles: { pms: "hr" } },
    };
    const res = mockRes();

    await getOrCreateFromAssignment(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it("400s when managerId equals the employee themselves (self-routing)", async () => {
    const employeeId = oid();
    const assignment = buildAssignment({ assignedTo: employeeId });
    KraAssignment.findById.mockResolvedValue(assignment);
    Submission.findOne.mockResolvedValue(null);
    const req = {
      params: { assignmentId: assignment._id },
      body: { managerId: employeeId },
      user: { _id: employeeId, roles: { pms: "employee" } },
    };
    const res = mockRes();

    await getOrCreateFromAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Submission.create).not.toHaveBeenCalled();
  });

  it("400s when the chosen managerId does not resolve to a manager/hr user", async () => {
    const employeeId = oid();
    const assignment = buildAssignment({ assignedTo: employeeId });
    KraAssignment.findById.mockResolvedValue(assignment);
    Submission.findOne.mockResolvedValue(null);
    const bogusManagerId = oid();
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ roles: { pms: "employee" } }) });
    const req = {
      params: { assignmentId: assignment._id },
      body: { managerId: bogusManagerId },
      user: { _id: employeeId, roles: { pms: "employee" } },
    };
    const res = mockRes();

    await getOrCreateFromAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Submission.create).not.toHaveBeenCalled();
  });

  it("returns the existing submission without creating a new one when one already exists", async () => {
    const employeeId = oid();
    const assignment = buildAssignment({ assignedTo: employeeId });
    KraAssignment.findById.mockResolvedValue(assignment);
    const existing = { _id: oid(), populate: vi.fn().mockResolvedValue() };
    Submission.findOne.mockResolvedValue(existing);
    const req = {
      params: { assignmentId: assignment._id },
      body: {},
      user: { _id: employeeId, roles: { pms: "employee" } },
    };
    const res = mockRes();

    await getOrCreateFromAssignment(req, res);

    expect(Submission.create).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(existing);
  });

  it("creates a submission seeded from the assignment's KRAs when none exists yet", async () => {
    const employeeId = oid();
    const managerId = oid();
    const assignment = buildAssignment({ assignedTo: employeeId });
    KraAssignment.findById.mockResolvedValue(assignment);
    Submission.findOne.mockResolvedValue(null);
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ roles: { pms: "manager" } }) });
    const created = { _id: oid(), populate: vi.fn().mockResolvedValue() };
    Submission.create.mockResolvedValue(created);
    const req = {
      params: { assignmentId: assignment._id },
      body: { managerId },
      user: { _id: employeeId, roles: { pms: "employee" } },
    };
    const res = mockRes();

    await getOrCreateFromAssignment(req, res);

    expect(Submission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cycleId: assignment.cycleId,
        assignmentId: assignment._id,
        employeeId: assignment.assignedTo,
        managerId,
        kraResponses: [
          { kraId: assignment.kras[0]._id, kraName: "Ship features", weight: 60, kpis: [{ title: "KPI 1" }] },
          { kraId: assignment.kras[1]._id, kraName: "Mentor juniors", weight: 40, kpis: [] },
        ],
      }),
    );
    expect(res.json).toHaveBeenCalledWith(created);
  });

  it("on a duplicate-key race, refetches the winner's submission instead of throwing", async () => {
    const employeeId = oid();
    const assignment = buildAssignment({ assignedTo: employeeId });
    KraAssignment.findById.mockResolvedValue(assignment);
    const winner = { _id: oid(), populate: vi.fn().mockResolvedValue() };
    Submission.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    const dupError = Object.assign(new Error("dup"), { code: 11000 });
    Submission.create.mockRejectedValue(dupError);
    const req = {
      params: { assignmentId: assignment._id },
      body: {},
      user: { _id: employeeId, roles: { pms: "employee" } },
    };
    const res = mockRes();

    await getOrCreateFromAssignment(req, res);

    expect(res.json).toHaveBeenCalledWith(winner);
    expect(res.status).not.toHaveBeenCalledWith(409);
  });

  it("409s if the duplicate-key race's refetch also comes up empty", async () => {
    const employeeId = oid();
    const assignment = buildAssignment({ assignedTo: employeeId });
    KraAssignment.findById.mockResolvedValue(assignment);
    Submission.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const dupError = Object.assign(new Error("dup"), { code: 11000 });
    Submission.create.mockRejectedValue(dupError);
    const req = {
      params: { assignmentId: assignment._id },
      body: {},
      user: { _id: employeeId, roles: { pms: "employee" } },
    };
    const res = mockRes();

    await getOrCreateFromAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

// ---------------------------------------------------------------------------
// saveResponses
// ---------------------------------------------------------------------------
describe("saveResponses", () => {
  const buildSubmission = ({ employeeId, status = "draft", kraResponses = [] }) => ({
    _id: oid(),
    employeeId,
    status,
    kraResponses,
    save: vi.fn().mockResolvedValue(undefined),
  });

  it("404s when the submission doesn't exist", async () => {
    Submission.findById.mockResolvedValue(null);
    const req = { params: { id: oid() }, body: {}, user: { _id: oid() } };
    const res = mockRes();

    await saveResponses(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403s a caller who is not the owning employee", async () => {
    const submission = buildSubmission({ employeeId: oid() });
    Submission.findById.mockResolvedValue(submission);
    const req = { params: { id: submission._id }, body: {}, user: { _id: oid() } };
    const res = mockRes();

    await saveResponses(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(submission.save).not.toHaveBeenCalled();
  });

  it("403s even the assigned manager (only the employee may save their own responses, per §02)", async () => {
    const managerId = oid();
    const submission = { ...buildSubmission({ employeeId: oid() }), managerId };
    Submission.findById.mockResolvedValue(submission);
    const req = { params: { id: submission._id }, body: {}, user: { _id: managerId, roles: { pms: "manager" } } };
    const res = mockRes();

    await saveResponses(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("409s when the submission status is not employee-editable", async () => {
    const employeeId = oid();
    const submission = buildSubmission({ employeeId, status: "pending_manager_approval" });
    Submission.findById.mockResolvedValue(submission);
    const req = { params: { id: submission._id }, body: { kraResponses: [] }, user: { _id: employeeId } };
    const res = mockRes();

    await saveResponses(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(submission.save).not.toHaveBeenCalled();
  });

  it("409s when status is 'manager_reviewed' — the self-review locks once the manager has responded, no revise-and-resubmit round", async () => {
    const employeeId = oid();
    const kraId = oid();
    const submission = buildSubmission({
      employeeId,
      status: "manager_reviewed",
      kraResponses: [{ kraId, response: "old", rating: 3 }],
    });
    Submission.findById.mockResolvedValue(submission);
    mockOpenWindow(employeeId);
    const req = {
      params: { id: submission._id },
      body: { kraResponses: [{ kraId, response: "updated", rating: 4 }] },
      user: { _id: employeeId },
    };
    const res = mockRes();

    await saveResponses(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(submission.save).not.toHaveBeenCalled();
  });

  it("409s when the cycle's response window isn't open for this employee", async () => {
    const employeeId = oid();
    const kraId = oid();
    const submission = buildSubmission({ employeeId, kraResponses: [{ kraId, response: "old", rating: 3 }] });
    Submission.findById.mockResolvedValue(submission);
    mockClosedWindow();
    const req = {
      params: { id: submission._id },
      body: { kraResponses: [{ kraId, response: "trying anyway", rating: 4 }] },
      user: { _id: employeeId },
    };
    const res = mockRes();

    await saveResponses(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(submission.save).not.toHaveBeenCalled();
  });

  it("400s when a rating is not an integer between 1 and 5", async () => {
    const employeeId = oid();
    const submission = buildSubmission({ employeeId, kraResponses: [{ kraId: oid() }] });
    Submission.findById.mockResolvedValue(submission);
    mockOpenWindow(employeeId);
    const req = {
      params: { id: submission._id },
      body: { kraResponses: [{ kraId: oid(), rating: 7 }] },
      user: { _id: employeeId },
    };
    const res = mockRes();

    await saveResponses(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(submission.save).not.toHaveBeenCalled();
  });

  it("accepts null as a rating (clears it) rather than rejecting it", async () => {
    const employeeId = oid();
    const kraId = oid();
    const submission = buildSubmission({ employeeId, kraResponses: [{ kraId, rating: 3 }] });
    Submission.findById.mockResolvedValue(submission);
    mockOpenWindow(employeeId);
    const req = {
      params: { id: submission._id },
      body: { kraResponses: [{ kraId, rating: null }] },
      user: { _id: employeeId },
    };
    const res = mockRes();

    await saveResponses(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(submission.kraResponses[0].rating).toBeNull();
  });

  it("patches only matched KRAs by kraId, leaving unmatched ones untouched, and saves", async () => {
    const employeeId = oid();
    const kraId1 = oid();
    const kraId2 = oid();
    const submission = buildSubmission({
      employeeId,
      kraResponses: [
        { kraId: kraId1, response: "r1", rating: 2, kpis: [] },
        { kraId: kraId2, response: "r2", rating: 3, kpis: [] },
      ],
    });
    Submission.findById.mockResolvedValue(submission);
    mockOpenWindow(employeeId);
    const req = {
      params: { id: submission._id },
      body: { kraResponses: [{ kraId: kraId1, response: "updated r1", rating: 5, kpis: [{ actual: 10 }] }] },
      user: { _id: employeeId },
    };
    const res = mockRes();

    await saveResponses(req, res);

    expect(submission.kraResponses[0]).toMatchObject({ response: "updated r1", rating: 5, kpis: [{ actual: 10 }] });
    expect(submission.kraResponses[1]).toMatchObject({ response: "r2", rating: 3 });
    expect(submission.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(submission);
  });

  it("ignores incoming entries whose kraId doesn't match any existing response", async () => {
    const employeeId = oid();
    const kraId = oid();
    const submission = buildSubmission({ employeeId, kraResponses: [{ kraId, response: "r1", rating: 2 }] });
    Submission.findById.mockResolvedValue(submission);
    mockOpenWindow(employeeId);
    const req = {
      params: { id: submission._id },
      body: { kraResponses: [{ kraId: oid(), response: "phantom", rating: 5 }] },
      user: { _id: employeeId },
    };
    const res = mockRes();

    await saveResponses(req, res);

    expect(submission.kraResponses).toHaveLength(1);
    expect(submission.kraResponses[0].response).toBe("r1");
  });
});

// ---------------------------------------------------------------------------
// employeeSubmit
// ---------------------------------------------------------------------------
describe("employeeSubmit", () => {
  const buildSubmission = ({
    employeeId,
    status = "draft",
    kraResponses = [
      { kraId: oid(), response: "Filled in", rating: 4 },
      { kraId: oid(), response: "Also filled in", rating: 3 },
    ],
  } = {}) => ({
    _id: oid(),
    employeeId,
    status,
    kraResponses,
    save: vi.fn().mockResolvedValue(undefined),
  });

  it("404s when the submission doesn't exist", async () => {
    Submission.findById.mockResolvedValue(null);
    const req = { params: { id: oid() }, user: { _id: oid() } };
    const res = mockRes();

    await employeeSubmit(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403s a caller who is not the owning employee", async () => {
    const submission = buildSubmission({ employeeId: oid() });
    Submission.findById.mockResolvedValue(submission);
    const req = { params: { id: submission._id }, user: { _id: oid() } };
    const res = mockRes();

    await employeeSubmit(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("409s when submitting from a non-editable status", async () => {
    const employeeId = oid();
    const submission = buildSubmission({ employeeId, status: "employee_submitted" });
    Submission.findById.mockResolvedValue(submission);
    mockOpenWindow(employeeId);
    const req = { params: { id: submission._id }, user: { _id: employeeId } };
    const res = mockRes();

    await employeeSubmit(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(submission.save).not.toHaveBeenCalled();
  });

  it("409s when the cycle's response window isn't open for this employee", async () => {
    const employeeId = oid();
    const submission = buildSubmission({ employeeId, status: "draft" });
    Submission.findById.mockResolvedValue(submission);
    mockClosedWindow();
    const req = { params: { id: submission._id }, user: { _id: employeeId } };
    const res = mockRes();

    await employeeSubmit(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(submission.save).not.toHaveBeenCalled();
  });

  it("400s when a KRA is missing a response or rating", async () => {
    const employeeId = oid();
    const submission = buildSubmission({
      employeeId,
      status: "draft",
      kraResponses: [
        { kraId: oid(), kraName: "Ship features", response: "Done", rating: 4 },
        { kraId: oid(), kraName: "Mentor juniors", response: "", rating: null },
      ],
    });
    Submission.findById.mockResolvedValue(submission);
    mockOpenWindow(employeeId);
    const req = { params: { id: submission._id }, user: { _id: employeeId } };
    const res = mockRes();

    await employeeSubmit(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(submission.save).not.toHaveBeenCalled();
  });

  it("first-round submit: draft -> employee_submitted, stamps every KRA response", async () => {
    const employeeId = oid();
    const submission = buildSubmission({ employeeId, status: "draft" });
    Submission.findById.mockResolvedValue(submission);
    mockOpenWindow(employeeId);
    const req = { params: { id: submission._id }, user: { _id: employeeId } };
    const res = mockRes();

    await employeeSubmit(req, res);

    expect(submission.status).toBe("employee_submitted");
    for (const r of submission.kraResponses) {
      expect(r.status).toBe("employee_submitted");
      expect(r.employeeSubmittedAt).toBeInstanceOf(Date);
    }
    expect(submission.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(submission);
  });

  it("409s a second-round submit from 'manager_reviewed' — no revise-and-resubmit round once the manager has responded", async () => {
    const employeeId = oid();
    const submission = buildSubmission({ employeeId, status: "manager_reviewed" });
    Submission.findById.mockResolvedValue(submission);
    mockOpenWindow(employeeId);
    const req = { params: { id: submission._id }, user: { _id: employeeId } };
    const res = mockRes();

    await employeeSubmit(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(submission.status).toBe("manager_reviewed");
  });

  it("does not notify the manager on submit (documents a gap vs. the reference doc, see report)", async () => {
    const employeeId = oid();
    const submission = buildSubmission({ employeeId, status: "draft" });
    Submission.findById.mockResolvedValue(submission);
    mockOpenWindow(employeeId);
    const req = { params: { id: submission._id }, user: { _id: employeeId } };
    const res = mockRes();

    await employeeSubmit(req, res);

    // The reference doc (§07) says this action emails the assigned manager.
    // The real controller has no notify/email import or call at all.
    expect(notifyUsers).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// managerReview
// ---------------------------------------------------------------------------
describe("managerReview", () => {
  const buildSubmission = ({ managerId, status = "employee_submitted", kraResponses }) => ({
    _id: oid(),
    employeeId: oid(),
    managerId,
    status,
    kraResponses: kraResponses || [
      { kraId: oid(), status: "employee_submitted" },
      { kraId: oid(), status: "employee_submitted" },
      { kraId: oid(), status: "employee_submitted" },
    ],
    finalReport: {},
    save: vi.fn().mockResolvedValue(undefined),
  });

  it("404s when the submission doesn't exist", async () => {
    Submission.findById.mockResolvedValue(null);
    const req = { params: { id: oid() }, body: {}, user: { _id: oid(), roles: { pms: "manager" } } };
    const res = mockRes();

    await managerReview(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403s a caller whose pms role is neither manager nor hr", async () => {
    const managerId = oid();
    const submission = buildSubmission({ managerId });
    Submission.findById.mockResolvedValue(submission);
    const req = {
      params: { id: submission._id },
      body: {},
      user: { _id: managerId, roles: { pms: "employee" } },
    };
    const res = mockRes();

    await managerReview(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("403s a manager who is not the assigned manager for this submission", async () => {
    const submission = buildSubmission({ managerId: oid() });
    Submission.findById.mockResolvedValue(submission);
    const req = {
      params: { id: submission._id },
      body: {},
      user: { _id: oid(), roles: { pms: "manager" } },
    };
    const res = mockRes();

    await managerReview(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(submission.save).not.toHaveBeenCalled();
  });

  it("allows HR to review a submission even when not the assigned manager", async () => {
    const submission = buildSubmission({ managerId: oid(), kraResponses: [] });
    Submission.findById.mockResolvedValue(submission);
    const req = {
      params: { id: submission._id },
      body: { kraReviews: [] },
      user: { _id: oid(), roles: { pms: "hr" } },
    };
    const res = mockRes();

    await managerReview(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it("409s when the submission isn't in a reviewable status", async () => {
    const managerId = oid();
    const submission = buildSubmission({ managerId, status: "draft" });
    Submission.findById.mockResolvedValue(submission);
    const req = {
      params: { id: submission._id },
      body: { kraReviews: [] },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await managerReview(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(submission.save).not.toHaveBeenCalled();
  });

  it("400s on an out-of-range managerRating", async () => {
    const managerId = oid();
    const submission = buildSubmission({ managerId });
    Submission.findById.mockResolvedValue(submission);
    const req = {
      params: { id: submission._id },
      body: { kraReviews: [{ kraId: submission.kraResponses[0].kraId, managerRating: 9 }] },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await managerReview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(submission.save).not.toHaveBeenCalled();
  });

  it("happy path: writes managerResponse/managerRating per reviewed KRA and rolls status employee_submitted -> manager_reviewed", async () => {
    const managerId = oid();
    const submission = buildSubmission({ managerId, kraResponses: [{ kraId: oid(), status: "employee_submitted" }] });
    Submission.findById.mockResolvedValue(submission);
    const target = submission.kraResponses[0];
    const req = {
      params: { id: submission._id },
      body: { kraReviews: [{ kraId: target.kraId, managerResponse: "Great work", managerRating: 5 }] },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await managerReview(req, res);

    expect(target.managerResponse).toBe("Great work");
    expect(target.managerRating).toBe(5);
    expect(target.status).toBe("manager_reviewed");
    expect(target.reviewedAt).toBeInstanceOf(Date);
    expect(submission.status).toBe("manager_reviewed");
    expect(submission.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(submission);
  });

  it("final round: final_employee_submitted -> final_manager_reviewed", async () => {
    const managerId = oid();
    const submission = buildSubmission({ managerId, status: "final_employee_submitted", kraResponses: [] });
    Submission.findById.mockResolvedValue(submission);
    const req = {
      params: { id: submission._id },
      body: { kraReviews: [] },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await managerReview(req, res);

    expect(submission.status).toBe("final_manager_reviewed");
  });

  // --- Status-rollup behavior --------------------------------------------
  // Every KRA must be decided before the overall status rolls up — a
  // partial managerReview call (missing response/rating on some KRAs) is
  // now rejected outright rather than silently rolling the whole submission
  // to "manager_reviewed" while some KRAs are left with no manager
  // feedback at all.
  it("400s and leaves everything untouched when only some KRAs were included in kraReviews", async () => {
    const managerId = oid();
    const submission = buildSubmission({ managerId }); // 3 kraResponses
    Submission.findById.mockResolvedValue(submission);
    const reviewedOne = submission.kraResponses[0];
    const originalStatus = submission.status;
    const req = {
      params: { id: submission._id },
      // Only 1 of 3 KRAs reviewed.
      body: { kraReviews: [{ kraId: reviewedOne.kraId, managerResponse: "ok", managerRating: 4 }] },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await managerReview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(reviewedOne.status).not.toBe("manager_reviewed");
    expect(submission.status).toBe(originalStatus);
    expect(submission.save).not.toHaveBeenCalled();
  });

  it("computes weight-adjusted employeeAvg/managerAvg and blends them 50/50 into overallRating", async () => {
    const managerId = oid();
    const submission = buildSubmission({
      managerId,
      kraResponses: [
        { kraId: oid(), status: "employee_submitted", weight: 70, rating: 5 },
        { kraId: oid(), status: "employee_submitted", weight: 30, rating: 3 },
      ],
    });
    Submission.findById.mockResolvedValue(submission);
    const [first, second] = submission.kraResponses;
    const req = {
      params: { id: submission._id },
      body: {
        kraReviews: [
          { kraId: first.kraId, managerResponse: "Great", managerRating: 4 },
          { kraId: second.kraId, managerResponse: "Good", managerRating: 4 },
        ],
      },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await managerReview(req, res);

    // employeeAvg = (5*70 + 3*30) / 100 = 4.4, managerAvg = (4*70 + 4*30) / 100 = 4
    expect(submission.finalReport.employeeAvg).toBeCloseTo(4.4);
    expect(submission.finalReport.managerAvg).toBe(4);
    // overallRating = round((4.4 + 4) / 2) = round(4.2) = 4
    expect(submission.finalReport.overallRating).toBe(4);
  });

  it("rolls up once every KRA has a manager response and rating, even split across the merged request + prior saves", async () => {
    const managerId = oid();
    const submission = buildSubmission({
      managerId,
      kraResponses: [
        // Already reviewed in an earlier call.
        { kraId: oid(), status: "employee_submitted", managerResponse: "Already reviewed", managerRating: 3 },
        { kraId: oid(), status: "employee_submitted" },
      ],
    });
    Submission.findById.mockResolvedValue(submission);
    const remaining = submission.kraResponses[1];
    const req = {
      params: { id: submission._id },
      body: { kraReviews: [{ kraId: remaining.kraId, managerResponse: "Now reviewed too", managerRating: 4 }] },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await managerReview(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(remaining.status).toBe("manager_reviewed");
    expect(submission.status).toBe("manager_reviewed");
    expect(submission.save).toHaveBeenCalled();
  });

  it("does not notify the employee of a rejection/modification (no such endpoint exists at all — see report)", async () => {
    const managerId = oid();
    const submission = buildSubmission({ managerId, kraResponses: [{ kraId: oid(), status: "employee_submitted" }] });
    Submission.findById.mockResolvedValue(submission);
    const req = {
      params: { id: submission._id },
      body: { kraReviews: [{ kraId: submission.kraResponses[0].kraId, managerResponse: "Needs work", managerRating: 2 }] },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await managerReview(req, res);

    expect(notifyUsers).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// setFinalReport
// ---------------------------------------------------------------------------
describe("setFinalReport", () => {
  const buildSubmission = ({ managerId, status = "final_manager_reviewed" }) => ({
    _id: oid(),
    employeeId: oid(),
    managerId,
    status,
    finalReport: {
      managerSubmitted: false,
      managerOverallResponse: "",
      managerAvg: null,
      overallRating: null,
      oneOnOneDate: null,
      oneOnOneComment: "",
    },
    save: vi.fn().mockResolvedValue(undefined),
  });

  it("403s a caller whose pms role is neither manager nor hr", async () => {
    const req = { params: { id: oid() }, body: {}, user: { _id: oid(), roles: { pms: "employee" } } };
    const res = mockRes();

    await setFinalReport(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Submission.findById).not.toHaveBeenCalled();
  });

  it("404s when the submission doesn't exist", async () => {
    Submission.findById.mockResolvedValue(null);
    const req = { params: { id: oid() }, body: {}, user: { _id: oid(), roles: { pms: "manager" } } };
    const res = mockRes();

    await setFinalReport(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403s a manager who is not the assigned manager for this submission", async () => {
    const submission = buildSubmission({ managerId: oid() });
    Submission.findById.mockResolvedValue(submission);
    const req = { params: { id: submission._id }, body: {}, user: { _id: oid(), roles: { pms: "manager" } } };
    const res = mockRes();

    await setFinalReport(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(submission.save).not.toHaveBeenCalled();
  });

  it("400s on an out-of-range overallRating", async () => {
    const managerId = oid();
    const submission = buildSubmission({ managerId });
    Submission.findById.mockResolvedValue(submission);
    const req = {
      params: { id: submission._id },
      body: { overallRating: 6 },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await setFinalReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(submission.save).not.toHaveBeenCalled();
  });

  it("400s on a managerAvg outside 0-5", async () => {
    const managerId = oid();
    const submission = buildSubmission({ managerId });
    Submission.findById.mockResolvedValue(submission);
    const req = {
      params: { id: submission._id },
      body: { managerAvg: 5.5 },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await setFinalReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("accepts a fractional managerAvg within range (it's a computed average, unlike the 1-5 integer per-KRA ratings)", async () => {
    const managerId = oid();
    const submission = buildSubmission({ managerId });
    Submission.findById.mockResolvedValue(submission);
    const req = {
      params: { id: submission._id },
      body: { managerAvg: 3.5 },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await setFinalReport(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(submission.finalReport.managerAvg).toBe(3.5);
  });

  it("happy path: HR writes the full final report (rating, 1:1 notes, overall response)", async () => {
    const submission = buildSubmission({ managerId: oid() });
    Submission.findById.mockResolvedValue(submission);
    const oneOnOneDate = "2026-08-10";
    const req = {
      params: { id: submission._id },
      body: {
        managerSubmitted: true,
        managerOverallResponse: "Strong quarter overall.",
        managerAvg: 4.2,
        overallRating: 4,
        oneOnOneDate,
        oneOnOneComment: "Discussed promotion path.",
      },
      user: { _id: oid(), roles: { pms: "hr" } },
    };
    const res = mockRes();

    await setFinalReport(req, res);

    expect(submission.finalReport).toMatchObject({
      managerSubmitted: true,
      managerOverallResponse: "Strong quarter overall.",
      managerAvg: 4.2,
      overallRating: 4,
      oneOnOneDate,
      oneOnOneComment: "Discussed promotion path.",
    });
    expect(submission.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(submission);
  });

  it("partial update: only the fields present in the body are changed, others are left as-is", async () => {
    const managerId = oid();
    const submission = buildSubmission({ managerId });
    submission.finalReport.managerOverallResponse = "Existing text";
    Submission.findById.mockResolvedValue(submission);
    const req = {
      params: { id: submission._id },
      body: { overallRating: 3 },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await setFinalReport(req, res);

    expect(submission.finalReport.overallRating).toBe(3);
    expect(submission.finalReport.managerOverallResponse).toBe("Existing text");
  });

  it("rejects with 409 while the submission is still in 'draft' — the employee must submit their self-review first", async () => {
    const managerId = oid();
    const submission = buildSubmission({ managerId, status: "draft" });
    Submission.findById.mockResolvedValue(submission);
    const req = {
      params: { id: submission._id },
      body: { overallRating: 4 },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await setFinalReport(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(submission.save).not.toHaveBeenCalled();
  });

  it("applies once the employee has submitted (status past 'draft')", async () => {
    const managerId = oid();
    const submission = buildSubmission({ managerId, status: "employee_submitted" });
    Submission.findById.mockResolvedValue(submission);
    const req = {
      params: { id: submission._id },
      body: { overallRating: 4 },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await setFinalReport(req, res);

    expect(res.status).not.toHaveBeenCalledWith(409);
    expect(submission.save).toHaveBeenCalled();
  });
});
