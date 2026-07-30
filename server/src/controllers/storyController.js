import mongoose from "mongoose";
import Story from "../models/Story.js";

export const listStories = async (req, res) => {
  const filter = {};
  if (req.query.sprintId) filter.sprintId = req.query.sprintId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.assignee) filter.assignee = req.query.assignee;
  res.json(await Story.find(filter).populate("assignee", "name email").sort({ createdAt: -1 }));
};

export const getStory = async (req, res) => {
  const story = await Story.findById(req.params.id).populate("assignee", "name email").populate("comments.user", "name email");
  if (!story) return res.status(404).json({ message: "Story not found" });
  res.json(story);
};

export const createStory = async (req, res) => {
  const { title, description, storyPoints, priority, sprintId, assignee, acceptanceCriteria } = req.body;
  if (!title || !sprintId) return res.status(400).json({ message: "title and sprintId are required" });

  const story = await Story.create({
    title,
    description,
    storyPoints,
    priority,
    sprintId,
    assignee: assignee || null,
    acceptanceCriteria,
    createdBy: req.user._id,
  });
  res.status(201).json(story);
};

export const updateStory = async (req, res) => {
  const { title, description, storyPoints, priority, status, assignee, acceptanceCriteria } = req.body;
  const story = await Story.findById(req.params.id);
  if (!story) return res.status(404).json({ message: "Story not found" });

  if (title !== undefined) story.title = title;
  if (description !== undefined) story.description = description;
  if (storyPoints !== undefined) story.storyPoints = storyPoints;
  if (priority !== undefined) story.priority = priority;
  if (status !== undefined) story.status = status;
  if (assignee !== undefined) story.assignee = assignee;
  if (acceptanceCriteria !== undefined) story.acceptanceCriteria = acceptanceCriteria;

  await story.save();
  res.json(story);
};

export const getStoryComments = async (req, res) => {
  const story = await Story.findById(req.params.id).populate("comments.user", "name email");
  if (!story) return res.status(404).json({ message: "Story not found" });
  res.json({ success: true, comments: story.comments || [] });
};

export const addStoryComment = async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ message: "text is required" });

  const story = await Story.findById(req.params.id);
  if (!story) return res.status(404).json({ message: "Story not found" });

  story.comments.push({ user: req.user._id, text });
  await story.save();
  await story.populate("comments.user", "name email");
  res.status(201).json({ success: true, comments: story.comments || [] });
};

export const getSprintTotalStoryPoints = async (req, res) => {
  const [result] = await Story.aggregate([
    { $match: { sprintId: new mongoose.Types.ObjectId(req.params.sprintId) } },
    { $group: { _id: "$sprintId", total: { $sum: "$storyPoints" } } },
  ]);
  res.json({ success: true, totalStoryPoints: result?.total || 0 });
};

export const deleteStory = async (req, res) => {
  const story = await Story.findByIdAndDelete(req.params.id);
  if (!story) return res.status(404).json({ message: "Story not found" });
  res.status(204).send();
};
