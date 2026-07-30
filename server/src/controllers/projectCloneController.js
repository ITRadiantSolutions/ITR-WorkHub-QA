import mongoose from "mongoose";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Sprint from "../models/Sprint.js";
import { isPMOrAdmin } from "../utils/projectAccess.js";

export const cloneProject = async (req, res) => {
  const { id: sourceProjectId } = req.params;
  const { name: newName, startDate, endDate, copySprints = true, copyTasks = true, copyMembers = true } = req.body;

  if (!isPMOrAdmin(req.user)) {
    return res.status(403).json({ message: "Only Admins and Project Managers can clone projects" });
  }
  if (!newName?.trim()) return res.status(400).json({ message: "New project name is required" });
  if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
    return res.status(400).json({ message: "End date must be after start date" });
  }

  const sourceProject = await Project.findById(sourceProjectId).populate("projectLead", "name").populate("teamMembers", "name");
  if (!sourceProject) return res.status(404).json({ message: "Source project not found" });

  const authorized =
    req.user.roles.tracker === "ADMIN" ||
    sourceProject.createdBy?.toString() === req.user._id.toString() ||
    sourceProject.projectLead?._id?.toString() === req.user._id.toString();
  if (!authorized) return res.status(403).json({ message: "Not authorized to clone this project" });

  const clonedProject = await Project.create({
    name: newName.trim(),
    description: sourceProject.description,
    status: "Planning",
    priority: sourceProject.priority,
    startDate: startDate ? new Date(startDate) : sourceProject.startDate,
    endDate: endDate ? new Date(endDate) : sourceProject.endDate,
    projectLead: copyMembers ? sourceProject.projectLead?._id : null,
    teamMembers: copyMembers ? sourceProject.teamMembers.map((m) => m._id) : [],
    createdBy: req.user._id,
  });

  const clonedCounts = { sprints: 0, tasks: 0 };
  const sprintIdMap = new Map();

  if (copySprints) {
    const sourceSprints = await Sprint.find({ projectId: sourceProjectId });
    if (sourceSprints.length) {
      const prepared = sourceSprints.map((sprint) => {
        const newId = new mongoose.Types.ObjectId();
        sprintIdMap.set(sprint._id.toString(), newId);
        return {
          _id: newId,
          name: sprint.name,
          goal: sprint.goal,
          status: "Planning",
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          projectId: clonedProject._id,
          createdBy: sprint.createdBy,
        };
      });
      await Sprint.insertMany(prepared);
      clonedCounts.sprints = prepared.length;
    }
  }

  if (copyTasks) {
    const sourceTasks = await Task.find({ projectId: sourceProjectId });
    if (sourceTasks.length) {
      const prepared = sourceTasks.map((task) => ({
        _id: new mongoose.Types.ObjectId(),
        title: task.title,
        description: task.description,
        status: "TODO",
        priority: task.priority,
        projectId: clonedProject._id,
        assignees: task.assignees || [],
        dueDate: task.dueDate || null,
        createdBy: task.createdBy,
        assignedAt: new Date(),
      }));
      await Task.insertMany(prepared);
      clonedCounts.tasks = prepared.length;
    }
  }

  await clonedProject.populate([
    { path: "projectLead", select: "name email" },
    { path: "teamMembers", select: "name email" },
  ]);

  res.status(201).json({ message: "Project cloned successfully", project: clonedProject, clonedCounts });
};
