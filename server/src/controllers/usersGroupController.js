import UsersGroup from "../models/UsersGroup.js";

const requirePmsHrOrManager = (req, res) => {
  if (!["hr", "manager"].includes(req.user.roles.pms)) {
    res.status(403).json({ message: "PMS Manager or HR access required" });
    return false;
  }
  return true;
};

// GET routes below populate members[] into {_id, name, email} objects for
// display. Clients that round-trip that shape back into create/update
// (stale bundle, direct API call) would otherwise hand Mongoose an object
// where it expects an ObjectId string — normalize at the boundary instead
// of trusting the caller.
const normalizeMemberIds = (members = []) =>
  members.map((m) => String(typeof m === "object" && m !== null ? m._id || m.id : m));

// A user can only belong to one group at a time — find any of the given
// member ids that already sit in some OTHER group's members[].
const findConflictingMembers = async (memberIds, excludeGroupId) => {
  if (!memberIds?.length) return [];
  const filter = { members: { $in: memberIds } };
  if (excludeGroupId) filter._id = { $ne: excludeGroupId };
  const conflicting = await UsersGroup.find(filter).populate("members", "name");

  const requested = new Set(memberIds.map(String));
  const names = new Set();
  for (const g of conflicting) {
    for (const m of g.members) {
      if (requested.has(String(m._id))) names.add(m.name);
    }
  }
  return [...names];
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

  const memberIds = normalizeMemberIds(members);
  const conflicts = await findConflictingMembers(memberIds);
  if (conflicts.length) {
    return res.status(400).json({ message: `Already in another group: ${conflicts.join(", ")}` });
  }

  const group = await UsersGroup.create({ name, description, members: memberIds, createdBy: req.user._id });
  res.status(201).json(group);
};

export const updateGroup = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const { name, description, members } = req.body;

  const group = await UsersGroup.findById(req.params.id);
  if (!group) return res.status(404).json({ message: "Group not found" });

  if (members !== undefined) {
    const conflicts = await findConflictingMembers(members, group._id);
    if (conflicts.length) {
      return res.status(400).json({ message: `Already in another group: ${conflicts.join(", ")}` });
    }
  }

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
