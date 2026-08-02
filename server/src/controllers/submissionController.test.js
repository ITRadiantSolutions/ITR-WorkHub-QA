import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Submission.js", () => ({
  default: { find: vi.fn(), findById: vi.fn(), findOne: vi.fn(), create: vi.fn() },
}));
vi.mock("../models/KraAssignment.js", () => ({ default: { findById: vi.fn() } }));
vi.mock("../models/User.js", () => ({ default: { findById: vi.fn() } }));
vi.mock("../utils/notify.js", () => ({ notifyUsers: vi.fn() }));

import Submission from "../models/Submission.js";
import KraAssignment from "../models/KraAssignment.js";
import User from "../models/User.js";
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

  it("Manager: always scoped to own reports (managerId), ignoring an employeeId query param", async () => {
    setupFind();
    const managerId = oid();
    const req = {
      query: { employeeId: oid() },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await listSubmissions(req, res);

    expect(Submission.find).toHaveBeenCalledWith({ managerId });
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

  it("populates employeeId name/email and returns the result", async () => {
    const populate = setupFind();
    const req = { query: {}, user: { _id: oid(), roles: { pms: "hr" } } };
    const res = mockRes();

    await listSubmissions(req, res);

    expect(populate).toHaveBeenCalledWith("employeeId", "name email");
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

  it("403s a manager who is not the assigned manager for this submission", async () => {
    const submission = { employeeId: oid(), managerId: oid() };
    setupFindById(submission);
    const req = { params: { id: oid() }, user: { _id: oid(), roles: { pms: "manager" } } };
    const res = mockRes();

    await getSubmission(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
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
    Submission.findOne.mockResolvedValue({ _id: oid() });
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
    const existing = { _id: oid() };
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
    const created = { _id: oid() };
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
    const winner = { _id: oid() };
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

  it("allows edits when status is 'manager_reviewed' (a later round of self-assessment)", async () => {
    const employeeId = oid();
    const kraId = oid();
    const submission = buildSubmission({
      employeeId,
      status: "manager_reviewed",
      kraResponses: [{ kraId, response: "old", rating: 3 }],
    });
    Submission.findById.mockResolvedValue(submission);
    const req = {
      params: { id: submission._id },
      body: { kraResponses: [{ kraId, response: "updated", rating: 4 }] },
      user: { _id: employeeId },
    };
    const res = mockRes();

    await saveResponses(req, res);

    expect(res.status).not.toHaveBeenCalledWith(409);
    expect(submission.kraResponses[0].response).toBe("updated");
  });

  it("400s when a rating is not an integer between 1 and 5", async () => {
    const employeeId = oid();
    const submission = buildSubmission({ employeeId, kraResponses: [{ kraId: oid() }] });
    Submission.findById.mockResolvedValue(submission);
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
  const buildSubmission = ({ employeeId, status = "draft", kraResponses = [{ kraId: oid() }, { kraId: oid() }] }) => ({
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
    const req = { params: { id: submission._id }, user: { _id: employeeId } };
    const res = mockRes();

    await employeeSubmit(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(submission.save).not.toHaveBeenCalled();
  });

  it("first-round submit: draft -> employee_submitted, stamps every KRA response", async () => {
    const employeeId = oid();
    const submission = buildSubmission({ employeeId, status: "draft" });
    Submission.findById.mockResolvedValue(submission);
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

  it("second-round submit: manager_reviewed -> final_employee_submitted", async () => {
    const employeeId = oid();
    const submission = buildSubmission({ employeeId, status: "manager_reviewed" });
    Submission.findById.mockResolvedValue(submission);
    const req = { params: { id: submission._id }, user: { _id: employeeId } };
    const res = mockRes();

    await employeeSubmit(req, res);

    expect(submission.status).toBe("final_employee_submitted");
  });

  it("does not notify the manager on submit (documents a gap vs. the reference doc, see report)", async () => {
    const employeeId = oid();
    const submission = buildSubmission({ employeeId, status: "draft" });
    Submission.findById.mockResolvedValue(submission);
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
    const submission = buildSubmission({ managerId: oid() });
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
    const submission = buildSubmission({ managerId });
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
    const submission = buildSubmission({ managerId, status: "final_employee_submitted" });
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
  // The reference doc (§03 Phase 4 / §06) describes a per-KRA
  // approve/reject/modify decision, with the *overall* submission status
  // only rolling up once every KRA has a decision (partial decisions should
  // leave the overall status unresolved). The real controller has no such
  // per-KRA decision states at all (no manager_rejected/manager_modify in
  // Submission.js's status enum, and no reject/modify endpoint exists in
  // submission.routes.js). Instead, a single managerReview call flips the
  // *entire* submission's status immediately, regardless of how many of the
  // submission's kraResponses were actually included in kraReviews.
  it("[divergence from doc] a single managerReview call rolls the WHOLE submission to manager_reviewed even when only some KRAs were included in kraReviews", async () => {
    const managerId = oid();
    const submission = buildSubmission({ managerId }); // 3 kraResponses
    Submission.findById.mockResolvedValue(submission);
    const reviewedOne = submission.kraResponses[0];
    const req = {
      params: { id: submission._id },
      // Only 1 of 3 KRAs reviewed.
      body: { kraReviews: [{ kraId: reviewedOne.kraId, managerResponse: "ok", managerRating: 4 }] },
      user: { _id: managerId, roles: { pms: "manager" } },
    };
    const res = mockRes();

    await managerReview(req, res);

    // The reviewed KRA is updated...
    expect(reviewedOne.status).toBe("manager_reviewed");
    // ...but the other two are left exactly as they were (never touched)...
    expect(submission.kraResponses[1].status).toBe("employee_submitted");
    expect(submission.kraResponses[2].status).toBe("employee_submitted");
    // ...yet the overall submission status is rolled up anyway. There is no
    // gating on "every KRA decided" anywhere in this function.
    expect(submission.status).toBe("manager_reviewed");
  });

  it("does not notify the employee of a rejection/modification (no such endpoint exists at all — see report)", async () => {
    const managerId = oid();
    const submission = buildSubmission({ managerId });
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

  it("[divergence from doc] applies with no status precondition — callable even while the submission is still in 'draft'", async () => {
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

    expect(res.status).not.toHaveBeenCalledWith(409);
    expect(submission.save).toHaveBeenCalled();
  });
});
