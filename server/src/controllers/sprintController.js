import Sprint from "../models/Sprint.js";
import Story from "../models/Story.js";

export const listSprints = async (req, res) => {
  const filter = {};
  if (req.query.projectId) filter.projectId = req.query.projectId;
  if (req.query.status) filter.status = req.query.status;
  res.json(await Sprint.find(filter).sort({ startDate: -1 }));
};

export const getSprint = async (req, res) => {
  const sprint = await Sprint.findById(req.params.id)
    .populate("comments.user", "name email roles")
    .populate("createdBy", "name email")
    .populate("projectId", "name");
  if (!sprint) return res.status(404).json({ message: "Sprint not found" });

  const [agg] = await Story.aggregate([
    { $match: { sprintId: sprint._id } },
    { $group: { _id: "$sprintId", total: { $sum: "$storyPoints" } } },
  ]);
  res.json({ ...sprint.toObject(), totalStoryPoints: agg?.total || 0 });
};

export const getSprintComments = async (req, res) => {
  const sprint = await Sprint.findById(req.params.id).populate("comments.user", "name email roles");
  if (!sprint) return res.status(404).json({ message: "Sprint not found" });
  res.json({ success: true, comments: sprint.comments });
};

export const createSprint = async (req, res) => {
  const { name, projectId, startDate, endDate, goal, status } = req.body;
  if (!name || !projectId || !startDate || !endDate) {
    return res.status(400).json({ message: "name, projectId, startDate and endDate are required" });
  }
  const sprint = await Sprint.create({ name, projectId, startDate, endDate, goal, status, createdBy: req.user._id });
  await sprint.populate([
    { path: "createdBy", select: "name email" },
    { path: "projectId", select: "name" },
  ]);
  res.status(201).json(sprint);
};

export const updateSprint = async (req, res) => {
  const { name, startDate, endDate, goal, status } = req.body;
  const sprint = await Sprint.findById(req.params.id);
  if (!sprint) return res.status(404).json({ message: "Sprint not found" });

  if (name !== undefined) sprint.name = name;
  if (startDate !== undefined) sprint.startDate = startDate;
  if (endDate !== undefined) sprint.endDate = endDate;
  if (goal !== undefined) sprint.goal = goal;
  if (status !== undefined) sprint.status = status;

  await sprint.save();
  await sprint.populate([
    { path: "createdBy", select: "name email" },
    { path: "projectId", select: "name" },
  ]);
  res.json(sprint);
};

export const addSprintComment = async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ message: "text is required" });

  const sprint = await Sprint.findById(req.params.id);
  if (!sprint) return res.status(404).json({ message: "Sprint not found" });

  sprint.comments.push({ user: req.user._id, text });
  await sprint.save();
  await sprint.populate("comments.user", "name email roles");
  res.status(201).json({ success: true, comments: sprint.comments });
};

export const deleteSprint = async (req, res) => {
  const sprint = await Sprint.findByIdAndDelete(req.params.id);
  if (!sprint) return res.status(404).json({ message: "Sprint not found" });
  res.status(204).send();
};
