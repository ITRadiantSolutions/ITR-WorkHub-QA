import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Referral.js", () => ({ default: { create: vi.fn(), findById: vi.fn(), find: vi.fn() } }));
vi.mock("../models/Candidate.js", () => ({ default: { findOneAndUpdate: vi.fn() } }));
vi.mock("../models/User.js", () => ({ default: { find: vi.fn() } }));
vi.mock("../config/blobStorage.js", () => ({ uploadAttachment: vi.fn(), createReadUrl: vi.fn() }));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("../utils/notify.js", () => ({ notifyUsers: vi.fn() }));

import Referral from "../models/Referral.js";
import Candidate from "../models/Candidate.js";
import User from "../models/User.js";
import { uploadAttachment, createReadUrl } from "../config/blobStorage.js";
import { notifyUsers } from "../utils/notify.js";
import { createReferral, updateReferralStatus, getResumeUrl } from "./hrmsReferralController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const hrUser = (id = oid()) => ({ _id: id, name: "Helen HR", roles: { hrms: "hr" } });
const employeeUser = (id = oid()) => ({ _id: id, name: "Eve Employee", roles: { hrms: "employee" } });

beforeEach(() => {
  vi.clearAllMocks();
  User.find.mockReturnValue({ select: vi.fn().mockResolvedValue([]) });
});

describe("createReferral", () => {
  const baseCandidate = { _id: oid(), name: "Cand Idate", email: "cand@x.com", save: vi.fn().mockResolvedValue(undefined) };

  it("400s when jobId or candidate name/email is missing", async () => {
    const req = { body: { jobId: oid().toString(), candidate: { name: "No Email" } }, user: employeeUser(), file: null };
    const res = mockRes();

    await createReferral(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Candidate.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("400s on candidate JSON that fails to parse", async () => {
    const req = { body: { jobId: oid().toString(), candidate: "{not json" }, user: employeeUser(), file: null };
    const res = mockRes();

    await createReferral(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("400s an unsupported resume mimetype", async () => {
    Candidate.findOneAndUpdate.mockResolvedValue(baseCandidate);
    const req = {
      body: { jobId: oid().toString(), candidate: { name: "Cand", email: "cand@x.com" } },
      user: employeeUser(),
      file: { mimetype: "image/png", buffer: Buffer.from(""), originalname: "resume.png" },
    };
    const res = mockRes();

    await createReferral(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(uploadAttachment).not.toHaveBeenCalled();
  });

  it("409s when the same candidate is referred for the same job twice", async () => {
    Candidate.findOneAndUpdate.mockResolvedValue(baseCandidate);
    Referral.create.mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));

    const req = {
      body: { jobId: oid().toString(), candidate: { name: "Cand", email: "cand@x.com" } },
      user: employeeUser(),
      file: null,
    };
    const res = mockRes();

    await createReferral(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("uploads the resume, upserts the candidate, and notifies HR on success", async () => {
    Candidate.findOneAndUpdate.mockResolvedValue({ ...baseCandidate });
    uploadAttachment.mockResolvedValue({ blobName: "hrms-resume/abc.pdf" });
    const created = { _id: oid(), populate: vi.fn().mockResolvedValue({ candidate: baseCandidate, job: {} }) };
    Referral.create.mockResolvedValue(created);
    const hrIds = [{ _id: oid() }];
    User.find.mockReturnValue({ select: vi.fn().mockResolvedValue(hrIds) });

    const employee = employeeUser();
    const req = {
      body: { jobId: oid().toString(), candidate: { name: "Cand", email: "cand@x.com" }, notes: "great fit" },
      user: employee,
      file: { mimetype: "application/pdf", buffer: Buffer.from("x"), originalname: "resume.pdf" },
    };
    const res = mockRes();

    await createReferral(req, res);

    expect(uploadAttachment).toHaveBeenCalledWith(expect.objectContaining({ scope: "hrms-resume" }));
    expect(Referral.create).toHaveBeenCalledWith(expect.objectContaining({ referredBy: employee._id, notes: "great fit" }));
    expect(notifyUsers).toHaveBeenCalledWith(
      hrIds.map((u) => u._id),
      expect.objectContaining({ type: "referralSubmitted" }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("updateReferralStatus", () => {
  it("400s an invalid status value", async () => {
    const req = { params: { id: oid().toString() }, body: { status: "made_up" }, user: hrUser() };
    const res = mockRes();

    await updateReferralStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Referral.findById).not.toHaveBeenCalled();
  });

  it("404s when the referral doesn't exist", async () => {
    Referral.findById.mockResolvedValue(null);
    const req = { params: { id: oid().toString() }, body: { status: "shortlisted" }, user: hrUser() };
    const res = mockRes();

    await updateReferralStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("pushes status history and notifies the referrer", async () => {
    const referrerId = oid();
    const referral = {
      _id: oid(), status: "submitted", referredBy: referrerId, statusHistory: [],
      save: vi.fn().mockResolvedValue(undefined),
      populate: vi.fn().mockResolvedValue({ status: "shortlisted" }),
    };
    Referral.findById.mockResolvedValue(referral);

    const req = { params: { id: referral._id.toString() }, body: { status: "shortlisted", note: "good resume" }, user: hrUser() };
    const res = mockRes();

    await updateReferralStatus(req, res);

    expect(referral.status).toBe("shortlisted");
    expect(referral.statusHistory).toHaveLength(1);
    expect(notifyUsers).toHaveBeenCalledWith([referrerId], expect.objectContaining({ type: "referralStatusChanged" }));
  });
});

describe("getResumeUrl", () => {
  it("404s when the referral doesn't exist", async () => {
    Referral.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(null) });
    const req = { params: { id: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await getResumeUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403s a user who is neither HR nor the original referrer", async () => {
    const referral = { referredBy: oid(), candidate: { resumeBlobName: "x.pdf" } };
    Referral.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(referral) });
    const req = { params: { id: oid().toString() }, user: employeeUser() };
    const res = mockRes();

    await getResumeUrl(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns a signed url for HR", async () => {
    const referral = { referredBy: oid(), candidate: { resumeBlobName: "hrms-resume/x.pdf" } };
    Referral.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue(referral) });
    createReadUrl.mockReturnValue("https://signed-url");
    const req = { params: { id: oid().toString() }, user: hrUser() };
    const res = mockRes();

    await getResumeUrl(req, res);

    expect(res.json).toHaveBeenCalledWith({ url: "https://signed-url" });
  });
});
