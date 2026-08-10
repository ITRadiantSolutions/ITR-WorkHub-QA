import ClientGroup from "../models/ClientGroup.js";

export const listClientGroups = async (req, res) => {
  res.json(await ClientGroup.find({}).populate("projects", "name status"));
};

export const getClientGroup = async (req, res) => {
  const group = await ClientGroup.findById(req.params.id).populate("projects", "name status");
  if (!group) return res.status(404).json({ message: "Client group not found" });
  res.json(group);
};

export const createClientGroup = async (req, res) => {
  const { name, description, status, projects } = req.body;
  if (!name || !projects?.length) {
    return res.status(400).json({ message: "name and at least one project are required" });
  }
  const group = await ClientGroup.create({ name, description, status, projects, createdBy: req.user._id });
  await group.populate("projects", "name status");
  res.status(201).json(group);
};

export const updateClientGroup = async (req, res) => {
  const { name, description, status, projects } = req.body;
  const group = await ClientGroup.findById(req.params.id);
  if (!group) return res.status(404).json({ message: "Client group not found" });

  if (name !== undefined) group.name = name;
  if (description !== undefined) group.description = description;
  if (status !== undefined) group.status = status;
  if (projects !== undefined) group.projects = projects;

  await group.save();
  await group.populate("projects", "name status");
  res.json(group);
};

export const deleteClientGroup = async (req, res) => {
  const group = await ClientGroup.findByIdAndDelete(req.params.id);
  if (!group) return res.status(404).json({ message: "Client group not found" });
  res.status(204).send();
};
