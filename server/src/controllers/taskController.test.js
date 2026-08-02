import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../models/Task.js", () => ({
  default: { create: vi.fn(), findById: vi.fn() },
}));
vi.mock("../models/User.js", () => ({ default: {} }));
vi.mock("../utils/notify.js", () => ({ notifyUsers: vi.fn() }));
vi.mock("../realtime/socket.js", () => ({ getIO: vi.fn(() => null) }));

import Task from "../models/Task.js";
import { notifyUsers } from "../utils/notify.js";
import { createTask, updateTask, changeTaskStatus } from "./taskController.js";

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

describe("createTask", () => {
  it("rejects a task missing title, projectId, or dueDate", async () => {
    const req = { body: { title: "" }, user: { _id: oid() } };
    const res = mockRes();

    await createTask(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Task.create).not.toHaveBeenCalled();
  });

  it("creates a task with title, description, priority and dueDate, and notifies assignees", async () => {
    const userId = oid();
    const projectId = oid();
    const assigneeId = oid();
    const createdTask = { _id: oid(), title: "Ship Q3 report" };
    Task.create.mockResolvedValue(createdTask);

    const req = {
      body: {
        title: "Ship Q3 report",
        description: "Pull the numbers and send to finance",
        projectId,
        assignees: [assigneeId],
        priority: "High",
        dueDate: "2026-09-01",
      },
      user: { _id: userId },
    };
    const res = mockRes();

    await createTask(req, res);

    expect(Task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Ship Q3 report",
        description: "Pull the numbers and send to finance",
        projectId,
        priority: "High",
        dueDate: "2026-09-01",
        createdBy: userId,
      }),
    );
    expect(notifyUsers).toHaveBeenCalledWith(
      [assigneeId],
      expect.objectContaining({ type: "taskAssigned", taskId: createdTask._id }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(createdTask);
  });
});

describe("updateTask", () => {
  const buildTask = ({ creatorId, assigneeIds = [] }) => ({
    _id: oid(),
    title: "Old title",
    description: "Old description",
    dueDate: "2026-01-01",
    assignees: assigneeIds,
    createdBy: creatorId,
    save: vi.fn().mockResolvedValue(undefined),
  });

  it("404s when the task doesn't exist", async () => {
    Task.findById.mockResolvedValue(null);
    const req = {
      params: { id: oid() },
      body: { description: "New description" },
      user: { _id: oid(), roles: { tracker: "DEVELOPER" } },
    };
    const res = mockRes();

    await updateTask(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("403s a caller who is not the assignee, creator, ADMIN, or PM", async () => {
    const task = buildTask({ creatorId: oid() });
    Task.findById.mockResolvedValue(task);
    const req = {
      params: { id: task._id },
      body: { description: "Trying to sneak an edit in" },
      user: { _id: oid(), roles: { tracker: "BUSINESS_USER" } },
    };
    const res = mockRes();

    await updateTask(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(task.save).not.toHaveBeenCalled();
    expect(task.description).toBe("Old description");
  });

  it("lets the assignee update description and dueDate", async () => {
    const userId = oid();
    const task = buildTask({ creatorId: oid(), assigneeIds: [userId] });
    Task.findById.mockResolvedValue(task);
    const req = {
      params: { id: task._id },
      body: { description: "Updated description", dueDate: "2026-09-15" },
      user: { _id: userId, roles: { tracker: "DEVELOPER" } },
    };
    const res = mockRes();

    await updateTask(req, res);

    expect(task.description).toBe("Updated description");
    expect(task.dueDate).toBe("2026-09-15");
    expect(task.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(task);
  });

  it("lets an ADMIN update a task they have no other relation to", async () => {
    const task = buildTask({ creatorId: oid() });
    Task.findById.mockResolvedValue(task);
    const req = {
      params: { id: task._id },
      body: { title: "Renamed by admin" },
      user: { _id: oid(), roles: { tracker: "ADMIN" } },
    };
    const res = mockRes();

    await updateTask(req, res);

    expect(task.title).toBe("Renamed by admin");
    expect(task.save).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it("notifies newly-added assignees but not ones already on the task", async () => {
    const creatorId = oid();
    const existingAssignee = oid();
    const newAssignee = oid();
    const task = buildTask({ creatorId, assigneeIds: [existingAssignee] });
    Task.findById.mockResolvedValue(task);
    const req = {
      params: { id: task._id },
      body: { assignees: [existingAssignee, newAssignee] },
      user: { _id: creatorId, roles: { tracker: "DEVELOPER" } },
    };
    const res = mockRes();

    await updateTask(req, res);

    expect(notifyUsers).toHaveBeenCalledWith([newAssignee], expect.objectContaining({ type: "taskAssigned" }));
  });
});

describe("changeTaskStatus", () => {
  const buildTask = ({ creatorId, assigneeIds = [] }) => ({
    _id: oid(),
    title: "A task",
    status: "TODO",
    assignees: assigneeIds,
    createdBy: creatorId,
    save: vi.fn().mockResolvedValue(undefined),
  });

  it("rejects a status value outside the allowed enum", async () => {
    const req = {
      body: { status: "ALMOST_DONE" },
      params: { id: oid() },
      user: { _id: oid(), roles: { tracker: "ADMIN" } },
    };
    const res = mockRes();

    await changeTaskStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Task.findById).not.toHaveBeenCalled();
  });

  it("403s a caller with no relationship to the task", async () => {
    const task = buildTask({ creatorId: oid() });
    Task.findById.mockResolvedValue(task);
    const req = {
      body: { status: "DONE" },
      params: { id: task._id },
      user: { _id: oid(), roles: { tracker: "QA" } },
    };
    const res = mockRes();

    await changeTaskStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(task.save).not.toHaveBeenCalled();
  });

  it("moves an assignee's task to IN_PROGRESS without stamping closedBy/closedAt", async () => {
    const userId = oid();
    const task = buildTask({ creatorId: oid(), assigneeIds: [userId] });
    Task.findById.mockResolvedValue(task);
    const req = {
      body: { status: "IN_PROGRESS" },
      params: { id: task._id },
      user: { _id: userId, roles: { tracker: "DEVELOPER" } },
    };
    const res = mockRes();

    await changeTaskStatus(req, res);

    expect(task.status).toBe("IN_PROGRESS");
    expect(task.closedBy).toBeUndefined();
    expect(task.closedAt).toBeUndefined();
    expect(task.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(task);
  });

  it("stamps closedBy/closedAt and notifies assignees + creator when moved to DONE", async () => {
    const userId = oid();
    const creatorId = oid();
    const task = buildTask({ creatorId, assigneeIds: [userId] });
    Task.findById.mockResolvedValue(task);
    const req = {
      body: { status: "DONE" },
      params: { id: task._id },
      user: { _id: userId, roles: { tracker: "DEVELOPER" } },
    };
    const res = mockRes();

    await changeTaskStatus(req, res);

    expect(task.status).toBe("DONE");
    expect(task.closedBy).toBe(userId);
    expect(task.closedAt).toBeInstanceOf(Date);
    expect(notifyUsers).toHaveBeenCalledWith(
      [userId, creatorId],
      expect.objectContaining({ type: "taskStatusChanged", metadata: { status: "DONE" } }),
    );
  });
});
