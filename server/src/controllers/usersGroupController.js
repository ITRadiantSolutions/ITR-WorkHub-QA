import UsersGroup from "../models/UsersGroup.js";

const requirePmsHrOrManager = (req, res) => {
  if (!["hr", "manager"].includes(req.user.roles.pms)) {
    res.status(403).json({ message: "PMS Manager or HR access required" });
    return false;
  }
  return true;
};

export const listGroups = async (req, res) => {
  res.json(await UsersGroup.find({}).populate("members", "name email"));
};

export const getGroup = async (req, res) => {
  const group = await UsersGroup.findById(req.params.id).populate("members", "name email");
  if (!group) return res.status(404).json({ message: "Group not found" });
  res.json(group);
};

export const createGroup = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const { name, description, members } = req.body;
  if (!name) return res.status(400).json({ message: "name is required" });

  const group = await UsersGroup.create({ name, description, members: members || [], createdBy: req.user._id });
  res.status(201).json(group);
};

export const updateGroup = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const { name, description, members } = req.body;

  const group = await UsersGroup.findById(req.params.id);
  if (!group) return res.status(404).json({ message: "Group not found" });

  if (name !== undefined) group.name = name;
  if (description !== undefined) group.description = description;
  if (members !== undefined) group.members = members;
  await group.save();
  res.json(group);
};

export const deleteGroup = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const group = await UsersGroup.findByIdAndDelete(req.params.id);
  if (!group) return res.status(404).json({ message: "Group not found" });
  res.status(204).send();
};
