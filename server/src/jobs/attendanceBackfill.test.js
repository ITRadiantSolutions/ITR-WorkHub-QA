import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/User.js", () => ({ default: { find: vi.fn() } }));
vi.mock("../controllers/hrmsAttendanceController.js", () => ({ recomputeDay: vi.fn() }));

import User from "../models/User.js";
import { recomputeDay } from "../controllers/hrmsAttendanceController.js";
import { runAttendanceBackfill } from "./attendanceBackfill.js";

const oid = () => new mongoose.Types.ObjectId();
const makeSelectQuery = (result) => ({ select: vi.fn().mockResolvedValue(result) });

beforeEach(() => {
  vi.clearAllMocks();
  recomputeDay.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runAttendanceBackfill", () => {
  it("defaults to yesterday's date when none is given", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T03:00:00Z")); // ~08:30 IST
    User.find.mockReturnValue(makeSelectQuery([]));

    const result = await runAttendanceBackfill();

    expect(result.date).toBe("2026-08-23");
  });

  it("excludes archived employees and recomputes every remaining one for the target date", async () => {
    const active = [{ _id: oid() }, { _id: oid() }];
    User.find.mockReturnValue(makeSelectQuery(active));

    const result = await runAttendanceBackfill({ dateStr: "2026-08-20" });

    expect(User.find).toHaveBeenCalledWith({ "archived.account": { $ne: true }, "archived.hrms": { $ne: true } });
    expect(recomputeDay).toHaveBeenCalledTimes(2);
    expect(recomputeDay).toHaveBeenCalledWith(active[0]._id, "2026-08-20");
    expect(recomputeDay).toHaveBeenCalledWith(active[1]._id, "2026-08-20");
    expect(result).toEqual({ date: "2026-08-20", processed: 2, failed: 0 });
  });

  it("processes employees in batches rather than all at once", async () => {
    const employees = Array.from({ length: 5 }, () => ({ _id: oid() }));
    User.find.mockReturnValue(makeSelectQuery(employees));

    const inFlightPeaks = [];
    let inFlight = 0;
    recomputeDay.mockImplementation(async () => {
      inFlight += 1;
      inFlightPeaks.push(inFlight);
      await Promise.resolve();
      inFlight -= 1;
    });

    await runAttendanceBackfill({ dateStr: "2026-08-20", batchSize: 2 });

    // With a batch size of 2, no more than 2 recomputeDay calls should ever
    // be in flight at once (5 employees -> batches of 2, 2, 1).
    expect(Math.max(...inFlightPeaks)).toBeLessThanOrEqual(2);
    expect(recomputeDay).toHaveBeenCalledTimes(5);
  });

  it("continues past an individual employee's failure so one bad record doesn't block the rest", async () => {
    const employees = [{ _id: oid() }, { _id: oid() }];
    User.find.mockReturnValue(makeSelectQuery(employees));
    recomputeDay.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({});
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await runAttendanceBackfill({ dateStr: "2026-08-20" });

    expect(recomputeDay).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ date: "2026-08-20", processed: 1, failed: 1 });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
