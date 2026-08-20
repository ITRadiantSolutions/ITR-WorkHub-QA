import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/User.js", () => ({
  default: { find: vi.fn(), findById: vi.fn(), countDocuments: vi.fn() },
}));

import User from "../models/User.js";
import { listEmployees } from "./hrmsEmployeeController.js";

const oid = () => new mongoose.Types.ObjectId();

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
};

// find(...).select(...).populate(...).sort(...) — resolves the array
// directly, or supports .skip()/.limit() being chained on before that
// resolution when pagination params are given.
const makeQuery = (result) => {
  const query = {};
  query.select = vi.fn().mockReturnValue(query);
  query.populate = vi.fn().mockReturnValue(query);
  query.sort = vi.fn().mockReturnValue(query);
  query.skip = vi.fn().mockReturnValue(query);
  query.limit = vi.fn().mockReturnValue(query);
  query.then = (resolve) => resolve(result);
  return query;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listEmployees", () => {
  it("returns the full roster as a plain array when no pagination params are given", async () => {
    const roster = [{ _id: oid(), name: "A" }, { _id: oid(), name: "B" }];
    User.find.mockReturnValue(makeQuery(roster));

    const req = { query: {} };
    const res = mockRes();

    await listEmployees(req, res);

    expect(User.countDocuments).not.toHaveBeenCalled();
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(roster);
  });

  it("filters by search across name/email", async () => {
    const query = makeQuery([]);
    User.find.mockReturnValue(query);

    await listEmployees({ query: { search: "eve" } }, mockRes());

    expect(User.find).toHaveBeenCalledWith(expect.objectContaining({
      $or: [{ name: { $regex: "eve", $options: "i" } }, { email: { $regex: "eve", $options: "i" } }],
    }));
  });

  it("paginates and sets X-Total-Count when limit is given", async () => {
    const page = [{ _id: oid(), name: "A" }];
    const query = makeQuery(page);
    User.find.mockReturnValue(query);
    User.countDocuments.mockResolvedValue(137);

    const res = mockRes();
    await listEmployees({ query: { limit: "25", page: "2" } }, res);

    expect(query.skip).toHaveBeenCalledWith(25); // (page 2 - 1) * 25
    expect(query.limit).toHaveBeenCalledWith(25);
    expect(res.setHeader).toHaveBeenCalledWith("X-Total-Count", 137);
    expect(res.json).toHaveBeenCalledWith(page);
  });

  it("caps limit at 200 to avoid an unbounded page size", async () => {
    const query = makeQuery([]);
    User.find.mockReturnValue(query);
    User.countDocuments.mockResolvedValue(0);

    await listEmployees({ query: { limit: "5000" } }, mockRes());

    expect(query.limit).toHaveBeenCalledWith(200);
  });

  it("defaults to page 1 when page is omitted", async () => {
    const query = makeQuery([]);
    User.find.mockReturnValue(query);
    User.countDocuments.mockResolvedValue(0);

    await listEmployees({ query: { limit: "25" } }, mockRes());

    expect(query.skip).toHaveBeenCalledWith(0);
  });
});
