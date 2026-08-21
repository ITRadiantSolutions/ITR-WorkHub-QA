import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/CompanyHoliday.js", () => ({
  default: { find: vi.fn(), findOneAndUpdate: vi.fn(), findOneAndDelete: vi.fn() },
}));
vi.mock("../utils/activityLog.js", () => ({ writeAuditLog: vi.fn() }));

import CompanyHoliday from "../models/CompanyHoliday.js";
import { listHolidays, addHoliday, removeHoliday } from "./hrmsHolidayController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

const hrUser = () => ({ _id: oid(), roles: { hrms: "hr" } });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("listHolidays", () => {
  it("defaults to the current year when none is given", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T00:00:00Z"));
    const sort = vi.fn().mockResolvedValue([]);
    CompanyHoliday.find.mockReturnValue({ sort });

    await listHolidays({ query: {} }, mockRes());

    expect(CompanyHoliday.find).toHaveBeenCalledWith({ date: { $gte: "2026-01-01", $lte: "2026-12-31" } });
  });

  it("uses the requested year, ignoring a non-4-digit value", async () => {
    const sort = vi.fn().mockResolvedValue([]);
    CompanyHoliday.find.mockReturnValue({ sort });

    await listHolidays({ query: { year: "2027" } }, mockRes());
    expect(CompanyHoliday.find).toHaveBeenCalledWith({ date: { $gte: "2027-01-01", $lte: "2027-12-31" } });
  });
});

describe("addHoliday", () => {
  it("400s on a missing/invalid date", async () => {
    const res = mockRes();
    await addHoliday({ body: { label: "x" }, user: hrUser() }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(CompanyHoliday.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("upserts by date and defaults isFloater to false", async () => {
    const hr = hrUser();
    const created = { _id: oid(), date: "2026-01-26", label: "Republic Day" };
    CompanyHoliday.findOneAndUpdate.mockResolvedValue(created);

    const req = { body: { date: "2026-01-26", label: "Republic Day" }, user: hr };
    const res = mockRes();
    await addHoliday(req, res);

    expect(CompanyHoliday.findOneAndUpdate).toHaveBeenCalledWith(
      { date: "2026-01-26" },
      { date: "2026-01-26", label: "Republic Day", isFloater: false, createdBy: hr._id },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
  });

  it("passes isFloater through when set", async () => {
    CompanyHoliday.findOneAndUpdate.mockResolvedValue({ _id: oid() });
    const req = { body: { date: "2026-09-14", label: "Ganesh Chaturthi", isFloater: true }, user: hrUser() };
    await addHoliday(req, mockRes());

    expect(CompanyHoliday.findOneAndUpdate).toHaveBeenCalledWith(
      { date: "2026-09-14" },
      expect.objectContaining({ isFloater: true }),
      expect.anything(),
    );
  });
});

describe("removeHoliday", () => {
  it("404s when the date has no holiday", async () => {
    CompanyHoliday.findOneAndDelete.mockResolvedValue(null);
    const res = mockRes();
    await removeHoliday({ params: { date: "2026-01-01" }, user: hrUser() }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("deletes by date", async () => {
    CompanyHoliday.findOneAndDelete.mockResolvedValue({ _id: oid(), date: "2026-01-01", label: "New Year" });
    const res = mockRes();
    await removeHoliday({ params: { date: "2026-01-01" }, user: hrUser() }, res);

    expect(CompanyHoliday.findOneAndDelete).toHaveBeenCalledWith({ date: "2026-01-01" });
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
