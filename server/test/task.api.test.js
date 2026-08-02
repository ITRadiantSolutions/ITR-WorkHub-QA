import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

// Env vars must be in place before app.js (and anything it imports) reads
// them, so this runs before any local imports below.
process.env.JWT_SECRET = "test-secret";
process.env.CLIENT_URL = "http://localhost:5173";

const { default: app } = await import("../src/app.js");
const { default: User } = await import("../src/models/User.js");
const { default: Task } = await import("../src/models/Task.js");
const { signToken } = await import("../src/utils/jwt.js");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Task.deleteMany({})]);
});

const makeUser = (overrides = {}) =>
  User.create({
    name: "Test User",
    email: `user-${new mongoose.Types.ObjectId()}@example.com`,
    password: "password123",
    approvalStatus: "Approved",
    roles: { timesheet: "employee", pms: "employee", tracker: "DEVELOPER" },
    ...overrides,
  });

const authHeader = (user) => ({ Authorization: `Bearer ${signToken(user)}` });

describe("Task API (real HTTP + real database)", () => {
  it("creates a task via POST /api/tasks with title, description and dueDate", async () => {
    const developer = await makeUser();
    const projectId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post("/api/tasks")
      .set(authHeader(developer))
      .send({
        title: "Ship Q3 report",
        description: "Pull the numbers and send to finance",
        projectId: projectId.toString(),
        assignees: [developer._id.toString()],
        priority: "High",
        dueDate: "2026-09-01",
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: "Ship Q3 report",
      description: "Pull the numbers and send to finance",
      status: "TODO",
      priority: "High",
    });

    const stored = await Task.findById(res.body._id);
    expect(stored).not.toBeNull();
    expect(stored.createdBy.toString()).toBe(developer._id.toString());
  });

  it("rejects a task missing title/projectId/dueDate with 400", async () => {
    const developer = await makeUser();

    const res = await request(app)
      .post("/api/tasks")
      .set(authHeader(developer))
      .send({ description: "No title or due date" });

    expect(res.status).toBe(400);
    expect(await Task.countDocuments()).toBe(0);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).post("/api/tasks").send({ title: "x" });
    expect(res.status).toBe(401);
  });

  describe("access control on an existing task", () => {
    let developer;
    let outsider;
    let admin;
    let task;

    beforeEach(async () => {
      developer = await makeUser({ name: "Dana Developer" });
      outsider = await makeUser({
        name: "Owen Outsider",
        roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER" },
      });
      admin = await makeUser({ name: "Alex Admin", roles: { timesheet: "employee", pms: "employee", tracker: "ADMIN" } });

      task = await Task.create({
        title: "Original title",
        description: "Original description",
        projectId: new mongoose.Types.ObjectId(),
        assignees: [developer._id],
        createdBy: developer._id,
        dueDate: "2026-01-01",
      });
    });

    it("lets the assignee view the task", async () => {
      const res = await request(app).get(`/api/tasks/${task._id}`).set(authHeader(developer));
      expect(res.status).toBe(200);
    });

    it("blocks a user with no relationship to the task from viewing it", async () => {
      const res = await request(app).get(`/api/tasks/${task._id}`).set(authHeader(outsider));
      expect(res.status).toBe(403);
    });

    it("lets the assignee update description and dueDate via PUT", async () => {
      const res = await request(app)
        .put(`/api/tasks/${task._id}`)
        .set(authHeader(developer))
        .send({ description: "Updated description", dueDate: "2026-09-15" });

      expect(res.status).toBe(200);
      expect(res.body.description).toBe("Updated description");

      const stored = await Task.findById(task._id);
      expect(stored.description).toBe("Updated description");
      expect(stored.dueDate.toISOString().slice(0, 10)).toBe("2026-09-15");
    });

    it("blocks an unrelated user from updating the task via PUT (403, DB unchanged)", async () => {
      const res = await request(app)
        .put(`/api/tasks/${task._id}`)
        .set(authHeader(outsider))
        .send({ description: "Should not be allowed" });

      expect(res.status).toBe(403);

      const stored = await Task.findById(task._id);
      expect(stored.description).toBe("Original description");
    });

    it("lets an ADMIN update a task they have no other relation to", async () => {
      const res = await request(app)
        .put(`/api/tasks/${task._id}`)
        .set(authHeader(admin))
        .send({ title: "Renamed by admin" });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Renamed by admin");
    });

    it("moves the task to DONE via PATCH status and stamps closedBy/closedAt", async () => {
      const res = await request(app)
        .patch(`/api/tasks/${task._id}/status`)
        .set(authHeader(developer))
        .send({ status: "DONE" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("DONE");

      const stored = await Task.findById(task._id);
      expect(stored.status).toBe("DONE");
      expect(stored.closedBy.toString()).toBe(developer._id.toString());
      expect(stored.closedAt).not.toBeNull();
    });

    it("rejects an invalid status value with 400", async () => {
      const res = await request(app)
        .patch(`/api/tasks/${task._id}/status`)
        .set(authHeader(developer))
        .send({ status: "ALMOST_DONE" });

      expect(res.status).toBe(400);

      const stored = await Task.findById(task._id);
      expect(stored.status).toBe("TODO");
    });

    it("blocks an unrelated user from changing status", async () => {
      const res = await request(app)
        .patch(`/api/tasks/${task._id}/status`)
        .set(authHeader(outsider))
        .send({ status: "DONE" });

      expect(res.status).toBe(403);

      const stored = await Task.findById(task._id);
      expect(stored.status).toBe("TODO");
    });

    it("blocks an unrelated user from deleting the task, and the creator can", async () => {
      const blocked = await request(app).delete(`/api/tasks/${task._id}`).set(authHeader(outsider));
      expect(blocked.status).toBe(403);
      expect(await Task.findById(task._id)).not.toBeNull();

      const allowed = await request(app).delete(`/api/tasks/${task._id}`).set(authHeader(developer));
      expect(allowed.status).toBe(204);
      expect(await Task.findById(task._id)).toBeNull();
    });
  });
});
