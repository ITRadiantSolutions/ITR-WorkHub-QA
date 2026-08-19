import SkillGroup from "../models/SkillGroup.js";

const isManager = (user) => user.isSuperAdmin || ["manager", "admin"].includes(user.roles.lms);

export const adminListSkillGroups = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  res.json(await SkillGroup.find().populate("members", "name email").sort({ name: 1 }));
};

export const adminGetSkillGroupById = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const group = await SkillGroup.findById(req.params.id).populate("members", "name email");
  if (!group) return res.status(404).json({ message: "Skill group not found" });
  res.json(group);
};

export const adminCreateSkillGroup = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: "name is required" });

  const existing = await SkillGroup.findOne({ name: { $regex: `^${name.trim()}$`, $options: "i" } });
  if (existing) return res.status(409).json({ message: `A skill group named "${name.trim()}" already exists` });

  const group = await SkillGroup.create({ name: name.trim(), description: description || "", createdBy: req.user._id });
  res.status(201).json(group);
};

export const adminUpdateSkillGroup = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const { name, description, isActive } = req.body;
  const group = await SkillGroup.findById(req.params.id);
  if (!group) return res.status(404).json({ message: "Skill group not found" });

  if (name !== undefined) {
    const existing = await SkillGroup.findOne({ _id: { $ne: group._id }, name: { $regex: `^${name.trim()}$`, $options: "i" } });
    if (existing) return res.status(409).json({ message: `A skill group named "${name.trim()}" already exists` });
    group.name = name.trim();
  }
  if (description !== undefined) group.description = description;
  if (isActive !== undefined) group.isActive = Boolean(isActive);
  await group.save();
  res.json(group);
};

export const adminDeleteSkillGroup = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const group = await SkillGroup.findByIdAndDelete(req.params.id);
  if (!group) return res.status(404).json({ message: "Skill group not found" });
  res.status(204).send();
};

export const adminAddMembers = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const { employeeIds } = req.body;
  if (!Array.isArray(employeeIds) || !employeeIds.length) return res.status(400).json({ message: "employeeIds must be a non-empty array" });

  const group = await SkillGroup.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { members: { $each: employeeIds } } },
    { new: true },
  ).populate("members", "name email");
  if (!group) return res.status(404).json({ message: "Skill group not found" });
  res.json(group);
};

export const adminRemoveMember = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const group = await SkillGroup.findByIdAndUpdate(
    req.params.id,
    { $pull: { members: req.params.employeeId } },
    { new: true },
  ).populate("members", "name email");
  if (!group) return res.status(404).json({ message: "Skill group not found" });
  res.json(group);
};
