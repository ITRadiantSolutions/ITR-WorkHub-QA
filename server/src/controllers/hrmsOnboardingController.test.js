import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Onboarding.js", () => ({
  default: { create: vi.fn(), find: vi.fn(), findById: vi.fn(), findOne: vi.fn(), DEFAULT_ITEMS: ["Offer accepted", "Documents collected"] },
}));
vi.mock("../models/User.js", () => ({ default: { findById: vi.fn() } }));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("../utils/notify.js", () => ({ notifyUsers: vi.fn() }));
vi.mock("../utils/hrmsMailer.js", () => ({ sendHrmsEmail: vi.fn() }));

import Onboarding from "../models/Onboarding.js";
import User from "../models/User.js";
import { notifyUsers } from "../utils/notify.js";
import { sendHrmsEmail } from "../utils/hrmsMailer.js";
import { startOnboarding, listOnboarding, getMyOnboarding, setOnboardingItem } from "./hrmsOnboardingController.js";

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

const hrUser = () => ({ _id: oid(), roles: { hrms: "hr" } });
const makeSelectQuery = (result) => ({ select: vi.fn().mockResolvedValue(result) });

beforeEach(() => {
  vi.clearAllMocks();
  User.findById.mockReturnValue(makeSelectQuery({ name: "Eve Employee", email: "eve@example.com" }));
});

describe("startOnboarding", () => {
  it("400s when employeeId is missing", async () => {
    const req = { body: {}, user: hrUser() };
    const res = mockRes();

    await startOnboarding(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Onboarding.create).not.toHaveBeenCalled();
  });

  it("404s an unknown employee", async () => {
    User.findById.mockReturnValue(makeSelectQuery(null));
    const req = { body: { employeeId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await startOnboarding(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(Onboarding.create).not.toHaveBeenCalled();
  });

  it("409s when onboarding already exists for this employee", async () => {
    const error = new Error("dup");
    error.code = 11000;
    Onboarding.create.mockRejectedValue(error);

    const req = { body: { employeeId: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await startOnboarding(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("creates a checklist from the default items, notifies, and emails the employee", async () => {
    Onboarding.create.mockResolvedValue({ _id: oid() });
    Onboarding.findById.mockReturnValue(makeQuery({}));

    const employeeId = oid();
    const req = { body: { employeeId: employeeId.toString() }, user: hrUser() };
    const res = mockRes();

    await startOnboarding(req, res);

    expect(Onboarding.create).toHaveBeenCalledWith(
      expect.objectContaining({ employee: employeeId.toString(), items: [{ label: "Offer accepted" }, { label: "Documents collected" }] }),
    );
    expect(notifyUsers).toHaveBeenCalledWith([employeeId.toString()], expect.objectContaining({ type: "onboardingStarted" }));
    expect(sendHrmsEmail).toHaveBeenCalledWith("eve@example.com", expect.any(String), expect.any(String), expect.any(String));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("listOnboarding", () => {
  it("filters by status when given", async () => {
    Onboarding.find.mockReturnValue(makeQuery([]));

    await listOnboarding({ query: { status: "in_progress" }, user: hrUser() }, mockRes());

    expect(Onboarding.find).toHaveBeenCalledWith({ status: "in_progress" });
  });
});

describe("getMyOnboarding", () => {
  it("404s when the caller has no onboarding record", async () => {
    Onboarding.findOne.mockReturnValue(makeQuery(null));
    const req = { user: { _id: oid() } };
    const res = mockRes();

    await getMyOnboarding(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("setOnboardingItem", () => {
  const makeOnboarding = (items, employeeId = oid()) => {
    // Mimic a mongoose DocumentArray: a real array (so .every works) with an
    // .id() lookup method attached, same as the real items subdocument array.
    items.id = (itemId) => items.find((i) => i._id.toString() === itemId.toString());
    return {
      _id: oid(), items, status: "in_progress",
      employee: { _id: employeeId, name: "Eve Employee", email: "eve@example.com" },
      save: vi.fn().mockResolvedValue(undefined),
    };
  };

  it("404s when onboarding isn't found", async () => {
    Onboarding.findById.mockReturnValue(makeQuery(null));
    const req = { params: { id: oid().toString(), itemId: oid().toString() }, body: { done: true }, user: hrUser() };
    const res = mockRes();

    await setOnboardingItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("404s when the checklist item isn't found", async () => {
    const onboarding = makeOnboarding([]);
    Onboarding.findById.mockReturnValue(makeQuery(onboarding));
    const req = { params: { id: onboarding._id.toString(), itemId: oid().toString() }, body: { done: true }, user: hrUser() };
    const res = mockRes();

    await setOnboardingItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("marks the checklist completed once every item is done, and notifies + emails the employee", async () => {
    const item = { _id: oid(), label: "Offer accepted", done: false };
    const employeeId = oid();
    const onboarding = makeOnboarding([item], employeeId);
    Onboarding.findById.mockReturnValueOnce(makeQuery(onboarding)).mockReturnValueOnce(makeQuery({}));

    const hr = hrUser();
    const req = { params: { id: onboarding._id.toString(), itemId: item._id.toString() }, body: { done: true }, user: hr };
    await setOnboardingItem(req, mockRes());

    expect(item.done).toBe(true);
    expect(onboarding.status).toBe("completed");
    expect(notifyUsers).toHaveBeenCalledWith([employeeId], expect.objectContaining({ type: "onboardingCompleted" }));
    expect(sendHrmsEmail).toHaveBeenCalledWith("eve@example.com", expect.any(String), expect.any(String), expect.any(String));
  });

  it("keeps status in_progress when other items are still pending, and doesn't notify completion", async () => {
    const item1 = { _id: oid(), label: "Offer accepted", done: false };
    const item2 = { _id: oid(), label: "Documents collected", done: false };
    const onboarding = makeOnboarding([item1, item2]);
    Onboarding.findById.mockReturnValueOnce(makeQuery(onboarding)).mockReturnValueOnce(makeQuery({}));

    const req = { params: { id: onboarding._id.toString(), itemId: item1._id.toString() }, body: { done: true }, user: hrUser() };
    await setOnboardingItem(req, mockRes());

    expect(onboarding.status).toBe("in_progress");
    expect(notifyUsers).not.toHaveBeenCalled();
  });
});
