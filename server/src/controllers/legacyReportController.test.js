import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Submission.js", () => ({
  default: { findOne: vi.fn(), find: vi.fn() },
}));
vi.mock("../models/KraAssignment.js", () => ({
  default: { findById: vi.fn() },
}));
vi.mock("../models/User.js", () => ({
  default: { find: vi.fn(), findById: vi.fn() },
}));
vi.mock("../models/Cycle.js", () => ({
  default: { findById: vi.fn() },
}));

import Submission from "../models/Submission.js";
import KraAssignment from "../models/KraAssignment.js";
import User from "../models/User.js";
import Cycle from "../models/Cycle.js";
import {
  getEmployeeReport,
  getManagerEmployeeReport,
  getHrEmployeeReport,
  listManagerEmployees,
  listAllEmployeeReports,
  listNonSubmitters,
  submitManagerReview,
  saveDraftReview,
  managerActionOnKra,
} from "./legacyReportController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

const employeeUser = (id = oid()) => ({ _id: id, roles: { pms: "employee" } });
const managerUser = (id = oid()) => ({ _id: id, roles: { pms: "manager" } });
const hrUser = (id = oid()) => ({ _id: id, roles: { pms: "hr" } });

// findOne(...).sort(...).populate(...).populate(...) — chainable + awaitable.
const findOneChain = (result) => {
  const q = {};
  q.sort = vi.fn().mockReturnValue(q);
  q.populate = vi.fn().mockReturnValue(q);
  q.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return q;
};

// find(...).populate(...) — resolves directly.
const findPopulateChain = (result) => ({ populate: vi.fn().mockResolvedValue(result) });

const buildSubmissionDoc = (overrides = {}) => ({
  employeeId: { _id: oid(), name: "Alice", email: "alice@corp.com", roles: { pms: "employee" } },
  managerId: { name: "Bob", email: "bob@corp.com" },
  assignmentId: null,
  cycleId: null,
  status: "final_manager_reviewed",
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  kraResponses: [
    {
      kraId: oid(),
      kraName: "Delivery",
      weight: 50,
      kpis: [],
      response: "Shipped on time",
      rating: 4,
      managerResponse: "Great work",
      managerRating: 5,
      status: "manager_reviewed",
    },
    {
      kraId: oid(),
      kraName: "Quality",
      weight: 50,
      kpis: [],
      response: "Some bugs",
      rating: 3,
      managerResponse: "",
      managerRating: null,
      status: "manager_reviewed",
    },
  ],
  finalReport: {
    managerSubmitted: true,
    managerOverallResponse: "",
    managerAvg: null,
    overallRating: 4,
    oneOnOneDate: null,
    oneOnOneComment: "",
  },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getEmployeeReport", () => {
  it("403s an employee requesting a report that isn't their own", async () => {
    const req = { params: { employeeId: oid().toString() }, user: employeeUser() };
    const res = mockRes();

    await getEmployeeReport(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Submission.findOne).not.toHaveBeenCalled();
  });

  it("404s when the employee has no submission at all", async () => {
    const userId = oid();
    Submission.findOne.mockReturnValue(findOneChain(null));
    const req = { params: { employeeId: userId.toString() }, user: employeeUser(userId) };
    const res = mockRes();

    await getEmployeeReport(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns the employee's own report with self/manager averages computed from rated KRAs only", async () => {
    const userId = oid();
    const doc = buildSubmissionDoc({ employeeId: { _id: userId, name: "Alice", email: "a@corp.com", roles: { pms: "employee" } } });
    Submission.findOne.mockReturnValue(findOneChain(doc));
    const req = { params: { employeeId: userId.toString() }, user: employeeUser(userId) };
    const res = mockRes();

    await getEmployeeReport(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeName: "Alice",
        status: "final_manager_reviewed",
        selfAvg: 3.5, // avg of ratings [4, 3]
        managerAvg: 5, // only one KRA has a managerRating > 0
        overallRating: 4,
        reportingManagerName: "Bob",
      }),
    );
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it("computes kra ids via kraIdFor: base KRAs get an assignment-scoped id, employee-added KRAs keep their own id", async () => {
    const userId = oid();
    const assignmentId = oid();
    const baseKraSubId = oid();
    const employeeAddedKraSubId = oid();
    const doc = buildSubmissionDoc({
      employeeId: { _id: userId, name: "Alice", email: "a@corp.com", roles: { pms: "employee" } },
      assignmentId,
      cycleId: null,
      kraResponses: [
        { kraId: baseKraSubId, kraName: "Base KRA", weight: 50, kpis: [], response: "", rating: null, managerResponse: "", managerRating: null, status: "pending" },
        { kraId: employeeAddedKraSubId, kraName: "Self-added KRA", weight: 50, kpis: [], response: "", rating: null, managerResponse: "", managerRating: null, status: "pending" },
      ],
    });
    Submission.findOne.mockReturnValue(findOneChain(doc));
    KraAssignment.findById.mockResolvedValue({
      _id: assignmentId,
      kras: {
        id: (subId) => (subId.toString() === employeeAddedKraSubId.toString() ? { isEmployeeAdded: true } : { isEmployeeAdded: false }),
      },
    });
    const req = { params: { employeeId: userId.toString() }, user: employeeUser(userId) };
    const res = mockRes();

    await getEmployeeReport(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.kras[0].id).toBe(`${assignmentId}-base-${baseKraSubId}`);
    expect(payload.kras[1].id).toBe(employeeAddedKraSubId.toString());
  });

  // Fixed (doc §03 Phase 5 / §02): an employee may only view once HR sets
  // visibility to "all" or adds them to "selected".
  it("403s an employee reading their own report while HR's cycle reportVisibility is 'none'", async () => {
    const userId = oid();
    const cycleId = oid();
    const doc = buildSubmissionDoc({
      employeeId: { _id: userId, name: "Alice", email: "a@corp.com", roles: { pms: "employee" } },
      cycleId,
      status: "final_manager_reviewed",
    });
    Submission.findOne.mockReturnValue(findOneChain(doc));
    Cycle.findById.mockResolvedValue({
      _id: cycleId,
      name: "Q1 2026",
      reportVisibility: { mode: "none", visibleTo: [] },
    });
    const req = { params: { employeeId: userId.toString() }, user: employeeUser(userId) };
    const res = mockRes();

    await getEmployeeReport(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows an employee to read their own report once reportVisibility is 'all'", async () => {
    const userId = oid();
    const cycleId = oid();
    const doc = buildSubmissionDoc({
      employeeId: { _id: userId, name: "Alice", email: "a@corp.com", roles: { pms: "employee" } },
      cycleId,
      status: "final_manager_reviewed",
    });
    Submission.findOne.mockReturnValue(findOneChain(doc));
    Cycle.findById.mockResolvedValue({
      _id: cycleId,
      name: "Q1 2026",
      reportVisibility: { mode: "all", visibleTo: [] },
    });
    const req = { params: { employeeId: userId.toString() }, user: employeeUser(userId) };
    const res = mockRes();

    await getEmployeeReport(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalled();
  });

  it("allows an employee to read their own report when reportVisibility is 'selected' and they're on the list", async () => {
    const userId = oid();
    const cycleId = oid();
    const doc = buildSubmissionDoc({
      employeeId: { _id: userId, name: "Alice", email: "a@corp.com", roles: { pms: "employee" } },
      cycleId,
      status: "final_manager_reviewed",
    });
    Submission.findOne.mockReturnValue(findOneChain(doc));
    Cycle.findById.mockResolvedValue({
      _id: cycleId,
      name: "Q1 2026",
      reportVisibility: { mode: "selected", visibleTo: [userId] },
    });
    const req = { params: { employeeId: userId.toString() }, user: employeeUser(userId) };
    const res = mockRes();

    await getEmployeeReport(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalled();
  });

  it("does not restrict manager/hr callers hitting this generic endpoint for any employeeId (only the employee branch is gated)", async () => {
    // Documents current behavior: getManagerEmployeeReport/getHrEmployeeReport exist as
    // separate, role-gated endpoints, but this shared endpoint's own role check only
    // fires for callers whose role is "employee" — a manager or hr caller sails through
    // regardless of whose report it is.
    const doc = buildSubmissionDoc();
    Submission.findOne.mockReturnValue(findOneChain(doc));
    const req = { params: { employeeId: oid().toString() }, user: managerUser() };
    const res = mockRes();

    await getEmployeeReport(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalled();
  });
});

describe("getManagerEmployeeReport", () => {
  it("403s a non-manager caller", async () => {
    const req = { params: { managerId: oid().toString(), employeeId: oid().toString() }, user: employeeUser() };
    const res = mockRes();

    await getManagerEmployeeReport(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Submission.findOne).not.toHaveBeenCalled();
  });

  it("404s when the employee has no submission", async () => {
    Submission.findOne.mockReturnValue(findOneChain(null));
    const req = { params: { managerId: oid().toString(), employeeId: oid().toString() }, user: managerUser() };
    const res = mockRes();

    await getManagerEmployeeReport(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns the report for a manager viewing their own report's employee", async () => {
    const manager = managerUser();
    const doc = buildSubmissionDoc({ managerId: { _id: manager._id, name: "This Manager", email: "m@corp.com" } });
    Submission.findOne.mockReturnValue(findOneChain(doc));
    const req = { params: { managerId: oid().toString(), employeeId: oid().toString() }, user: manager };
    const res = mockRes();

    await getManagerEmployeeReport(req, res);

    expect(res.json).toHaveBeenCalled();
  });

  // Fixed (doc §02 "View team/all reports: Manager (own reports)"): a manager
  // who is not this employee's assigned manager is now forbidden, matching
  // submissionController.js's isAssignedManagerOrHr pattern.
  it("403s a manager who is not this employee's assigned manager", async () => {
    const callingManager = managerUser(); // this manager is not the employee's actual manager
    const doc = buildSubmissionDoc(); // doc.managerId is an unrelated { name: "Bob", email: ... }
    Submission.findOne.mockReturnValue(findOneChain(doc));
    const req = {
      params: { managerId: oid().toString(), employeeId: oid().toString() }, // arbitrary managerId in the URL
      user: callingManager,
    };
    const res = mockRes();

    await getManagerEmployeeReport(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("getHrEmployeeReport", () => {
  it("403s a non-hr caller", async () => {
    const req = { params: { employeeId: oid().toString() }, user: managerUser() };
    const res = mockRes();

    await getHrEmployeeReport(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Submission.findOne).not.toHaveBeenCalled();
  });

  it("404s when the employee has no submission", async () => {
    Submission.findOne.mockReturnValue(findOneChain(null));
    const req = { params: { employeeId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await getHrEmployeeReport(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns the report for hr regardless of employee", async () => {
    const doc = buildSubmissionDoc();
    Submission.findOne.mockReturnValue(findOneChain(doc));
    const req = { params: { employeeId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await getHrEmployeeReport(req, res);

    expect(res.json).toHaveBeenCalled();
  });
});

describe("listManagerEmployees", () => {
  it("403s a non-manager caller", async () => {
    const req = { params: { managerId: oid().toString() }, user: employeeUser() };
    const res = mockRes();

    await listManagerEmployees(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Submission.find).not.toHaveBeenCalled();
  });

  it("returns rows for the manager's team", async () => {
    const managerId = oid();
    const submissions = [
      {
        employeeId: { _id: oid(), name: "Alice", email: "a@corp.com", roles: { pms: "employee" } },
        status: "manager_reviewed",
        finalReport: { overallRating: 4, oneOnOneDate: null, managerOverallResponse: "Nice" },
        updatedAt: new Date("2026-06-01"),
      },
    ];
    Submission.find.mockReturnValue(findPopulateChain(submissions));
    const req = { params: { managerId: managerId.toString() }, user: managerUser(managerId) };
    const res = mockRes();

    await listManagerEmployees(req, res);

    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ employeeName: "Alice", overallRating: 4, managerResponse: "Nice" }),
    ]);
  });

  // Fixed (doc §02 "Manager (own reports)"): the query is now always scoped
  // to the caller's own id, never to a URL-supplied managerId.
  it("ignores req.params.managerId and always scopes to the caller's own id", async () => {
    const callingManagerId = oid();
    const otherManagerId = oid(); // a different manager's id, supplied in the URL
    Submission.find.mockReturnValue(findPopulateChain([]));
    const req = { params: { managerId: otherManagerId.toString() }, user: managerUser(callingManagerId) };
    const res = mockRes();

    await listManagerEmployees(req, res);

    expect(Submission.find).toHaveBeenCalledWith({ managerId: callingManagerId });
  });
});

describe("listAllEmployeeReports", () => {
  it("403s a non-hr caller", async () => {
    const req = { user: managerUser() };
    const res = mockRes();

    await listAllEmployeeReports(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Submission.find).not.toHaveBeenCalled();
  });

  it("returns rows for every submission, for hr", async () => {
    const submissions = [
      {
        employeeId: { _id: oid(), name: "Alice", email: "a@corp.com", roles: { pms: "employee" } },
        status: "final_manager_reviewed",
        finalReport: { overallRating: 5, oneOnOneDate: null, managerOverallResponse: "" },
        updatedAt: new Date("2026-06-01"),
      },
      {
        employeeId: { _id: oid(), name: "Zed", email: "z@corp.com", roles: { pms: "employee" } },
        status: "draft",
        finalReport: { overallRating: null, oneOnOneDate: null, managerOverallResponse: "" },
        updatedAt: new Date("2026-06-02"),
      },
    ];
    Submission.find.mockReturnValue(findPopulateChain(submissions));
    const req = { user: hrUser() };
    const res = mockRes();

    await listAllEmployeeReports(req, res);

    expect(Submission.find).toHaveBeenCalledWith({});
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ employeeName: "Alice" }),
      expect.objectContaining({ employeeName: "Zed" }),
    ]);
  });
});

describe("listNonSubmitters", () => {
  // Fixed access-control gap: unlike every other list/report endpoint in
  // this file, listNonSubmitters never checked req.user.roles.pms at all.
  it("403s a plain employee caller", async () => {
    const req = { query: {}, user: employeeUser() };
    const res = mockRes();

    await listNonSubmitters(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(User.find).not.toHaveBeenCalled();
  });

  it("a manager is always scoped to their own team, ignoring any manager_id query param", async () => {
    const managerId = oid();
    const userFindSelect = vi.fn().mockResolvedValue([]);
    User.find.mockReturnValue({ select: userFindSelect });
    Submission.find.mockReturnValue({ select: vi.fn().mockResolvedValue([]) });
    const req = { query: { manager_id: oid().toString() }, user: managerUser(managerId) };
    const res = mockRes();

    await listNonSubmitters(req, res);

    expect(User.find).toHaveBeenCalledWith({ managerId: managerId.toString() });
  });

  it("filters users by manager_id query param when provided", async () => {
    const managerId = oid().toString();
    const userFindSelect = vi.fn().mockResolvedValue([]);
    User.find.mockReturnValue({ select: userFindSelect });
    Submission.find.mockReturnValue({ select: vi.fn().mockResolvedValue([]) });
    const req = { query: { manager_id: managerId }, user: hrUser() };
    const res = mockRes();

    await listNonSubmitters(req, res);

    expect(User.find).toHaveBeenCalledWith({ managerId });
  });

  it("excludes users who already have a submission", async () => {
    const submitter = oid();
    const nonSubmitter = oid();
    User.find.mockReturnValue({
      select: vi.fn().mockResolvedValue([
        { _id: submitter, name: "Has Submitted", email: "s@corp.com" },
        { _id: nonSubmitter, name: "Has Not", email: "n@corp.com" },
      ]),
    });
    Submission.find.mockReturnValue({ select: vi.fn().mockResolvedValue([{ employeeId: submitter }]) });
    const req = { query: {}, user: hrUser() };
    const res = mockRes();

    await listNonSubmitters(req, res);

    expect(res.json).toHaveBeenCalledWith([{ id: nonSubmitter, name: "Has Not", email: "n@corp.com" }]);
  });
});

describe("submitManagerReview", () => {
  it("403s a caller who is neither manager nor hr", async () => {
    const req = { body: { employeeId: oid(), templateId: oid() }, user: employeeUser() };
    const res = mockRes();

    await submitManagerReview(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Submission.findOne).not.toHaveBeenCalled();
  });

  it("404s when no matching submission exists", async () => {
    Submission.findOne.mockResolvedValue(null);
    const req = { body: { employeeId: oid(), templateId: oid() }, user: managerUser() };
    const res = mockRes();

    await submitManagerReview(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("writes per-kra manager response/rating, finalizes status, and rolls the assignment forward", async () => {
    const kraSubId = oid();
    const assignmentId = oid();
    const manager = managerUser();
    const submission = {
      kraResponses: [{ kraId: kraSubId, managerResponse: "", managerRating: null, status: "employee_submitted", reviewedAt: null }],
      status: "employee_submitted",
      finalReport: {},
      managerId: manager._id,
      save: vi.fn().mockResolvedValue(undefined),
    };
    const assignment = { status: "employee_submitted", save: vi.fn().mockResolvedValue(undefined) };
    Submission.findOne.mockResolvedValue(submission);
    KraAssignment.findById.mockResolvedValue(assignment);
    const req = {
      body: {
        employeeId: oid(),
        templateId: assignmentId,
        kras: [{ id: kraSubId.toString(), managerResponse: "Great job", managerRating: 5 }],
        overallResponse: "Strong quarter",
        overallRating: 5,
        oneOnOneDate: "2026-07-15",
        oneOnOneComment: "Discussed growth",
      },
      user: manager,
    };
    const res = mockRes();

    await submitManagerReview(req, res);

    expect(submission.kraResponses[0].managerResponse).toBe("Great job");
    expect(submission.kraResponses[0].managerRating).toBe(5);
    expect(submission.kraResponses[0].status).toBe("manager_reviewed");
    expect(submission.status).toBe("final_manager_reviewed");
    expect(submission.finalReport).toEqual(
      expect.objectContaining({
        managerSubmitted: true,
        managerOverallResponse: "Strong quarter",
        overallRating: 5,
        oneOnOneDate: "2026-07-15",
        oneOnOneComment: "Discussed growth",
      }),
    );
    expect(submission.save).toHaveBeenCalled();
    expect(assignment.status).toBe("final_manager_reviewed");
    expect(assignment.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: "Manager review submitted" });
  });

  it("resolves a '<assignmentId>-base-<subId>' composite kra id down to the underlying subId", async () => {
    const kraSubId = oid();
    const submission = {
      kraResponses: [{ kraId: kraSubId, managerResponse: "", managerRating: null, status: "employee_submitted" }],
      status: "employee_submitted",
      finalReport: {},
      save: vi.fn().mockResolvedValue(undefined),
    };
    Submission.findOne.mockResolvedValue(submission);
    KraAssignment.findById.mockResolvedValue(null);
    const req = {
      body: {
        employeeId: oid(),
        templateId: oid(),
        kras: [{ id: `${oid()}-base-${kraSubId}`, managerResponse: "Solid", managerRating: 4 }],
      },
      user: hrUser(),
    };
    const res = mockRes();

    await submitManagerReview(req, res);

    expect(submission.kraResponses[0].managerResponse).toBe("Solid");
    expect(submission.kraResponses[0].managerRating).toBe(4);
  });

  // Fixed: no ownership check previously existed here, unlike
  // submissionController.isAssignedManagerOrHr.
  it("403s a manager who is not this submission's assigned manager", async () => {
    const submission = {
      kraResponses: [],
      status: "employee_submitted",
      finalReport: {},
      managerId: oid(), // the actually-assigned manager
      save: vi.fn().mockResolvedValue(undefined),
    };
    Submission.findOne.mockResolvedValue(submission);
    KraAssignment.findById.mockResolvedValue(null);
    const unrelatedManager = managerUser(); // not submission.managerId
    const req = {
      body: { employeeId: oid(), templateId: oid(), kras: [] },
      user: unrelatedManager,
    };
    const res = mockRes();

    await submitManagerReview(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(submission.save).not.toHaveBeenCalled();
  });
});

describe("saveDraftReview", () => {
  it("403s a caller who is neither manager nor hr", async () => {
    const req = { body: { employeeId: oid(), templateId: oid() }, user: employeeUser() };
    const res = mockRes();

    await saveDraftReview(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Submission.findOne).not.toHaveBeenCalled();
  });

  it("404s when no matching submission exists", async () => {
    Submission.findOne.mockResolvedValue(null);
    const req = { body: { employeeId: oid(), templateId: oid() }, user: managerUser() };
    const res = mockRes();

    await saveDraftReview(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updates matching kra manager fields and the 1:1 date/comment, saving without changing status", async () => {
    const kraSubId = oid();
    const manager = managerUser();
    const submission = {
      kraResponses: [{ kraId: kraSubId, managerResponse: "", managerRating: null }],
      status: "employee_submitted",
      finalReport: { oneOnOneDate: null, oneOnOneComment: "" },
      managerId: manager._id,
      save: vi.fn().mockResolvedValue(undefined),
    };
    Submission.findOne.mockResolvedValue(submission);
    const req = {
      body: {
        employeeId: oid(),
        templateId: oid(),
        kras: [{ kraId: kraSubId.toString(), managerResponse: "Draft note", managerRating: 3 }],
        oneOnOneDate: "2026-07-20",
        oneOnOneComment: "Tentative notes",
      },
      user: manager,
    };
    const res = mockRes();

    await saveDraftReview(req, res);

    expect(submission.kraResponses[0].managerResponse).toBe("Draft note");
    expect(submission.kraResponses[0].managerRating).toBe(3);
    expect(submission.finalReport.oneOnOneDate).toBe("2026-07-20");
    expect(submission.finalReport.oneOnOneComment).toBe("Tentative notes");
    expect(submission.status).toBe("employee_submitted"); // unchanged — this is a draft save
    expect(submission.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: "Draft saved" });
  });

  it("keeps existing oneOnOneDate/Comment when not provided in the body", async () => {
    const manager = managerUser();
    const submission = {
      kraResponses: [],
      finalReport: { oneOnOneDate: "2026-05-01", oneOnOneComment: "Old note" },
      managerId: manager._id,
      save: vi.fn().mockResolvedValue(undefined),
    };
    Submission.findOne.mockResolvedValue(submission);
    const req = { body: { employeeId: oid(), templateId: oid(), kras: [] }, user: manager };
    const res = mockRes();

    await saveDraftReview(req, res);

    expect(submission.finalReport.oneOnOneDate).toBe("2026-05-01");
    expect(submission.finalReport.oneOnOneComment).toBe("Old note");
  });
});

describe("managerActionOnKra", () => {
  it("403s a caller who is neither manager nor hr", async () => {
    const req = { body: { templateId: oid(), action: "approve" }, user: employeeUser() };
    const res = mockRes();

    await managerActionOnKra(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(KraAssignment.findById).not.toHaveBeenCalled();
  });

  it("404s when the assignment/template doesn't exist", async () => {
    KraAssignment.findById.mockResolvedValue(null);
    const req = { body: { templateId: oid(), action: "approve" }, user: managerUser() };
    const res = mockRes();

    await managerActionOnKra(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("sets status to manager_approved on 'approve'", async () => {
    const manager = managerUser();
    const assignedTo = oid();
    const assignment = { assignedTo, status: "employee_submitted", save: vi.fn().mockResolvedValue(undefined) };
    KraAssignment.findById.mockResolvedValue(assignment);
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ managerId: manager._id }) });
    const req = { body: { templateId: oid(), action: "approve" }, user: manager };
    const res = mockRes();

    await managerActionOnKra(req, res);

    expect(assignment.status).toBe("manager_approved");
    expect(assignment.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ status: "manager_approved" });
  });

  it("403s a manager who is not the assignee's manager", async () => {
    const assignedTo = oid();
    const assignment = { assignedTo, status: "employee_submitted", save: vi.fn().mockResolvedValue(undefined) };
    KraAssignment.findById.mockResolvedValue(assignment);
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ managerId: oid() }) });
    const req = { body: { templateId: oid(), action: "approve" }, user: managerUser() };
    const res = mockRes();

    await managerActionOnKra(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(assignment.save).not.toHaveBeenCalled();
  });

  it("sets status to rejected on any non-'approve' action (e.g. 'reject' or 'modify')", async () => {
    const assignment = { status: "employee_submitted", save: vi.fn().mockResolvedValue(undefined) };
    KraAssignment.findById.mockResolvedValue(assignment);
    const req = { body: { templateId: oid(), action: "reject" }, user: hrUser() };
    const res = mockRes();

    await managerActionOnKra(req, res);

    expect(assignment.status).toBe("rejected");
    expect(res.json).toHaveBeenCalledWith({ status: "rejected" });
  });
});
