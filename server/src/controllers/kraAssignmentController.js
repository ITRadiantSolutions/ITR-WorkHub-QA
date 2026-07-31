import KraAssignment from "../models/KraAssignment.js";
import UsersGroup from "../models/UsersGroup.js";

const requirePmsHr = (req, res) => {
  if (req.user.roles.pms !== "hr") {
    res.status(403).json({ message: "PMS HR access required" });
    return false;
  }
  return true;
};

export const listAssignments = async (req, res) => {
  const filter = {};
  if (req.query.cycleId) filter.cycleId = req.query.cycleId;
  if (req.query.userId) filter.assignedTo = req.query.userId;
  else if (req.user.roles.pms !== "hr") filter.assignedTo = req.user._id;

  res.json(await KraAssignment.find(filter).populate("assignedTo", "name email"));
};

export const getAssignment = async (req, res) => {
  const assignment = await KraAssignment.findById(req.params.id).populate("assignedTo", "name email managerId");
  if (!assignment) return res.status(404).json({ message: "Assignment not found" });

  const isSelf = assignment.assignedTo?._id?.equals(req.user._id);
  const isHr = req.user.roles.pms === "hr";
  const isManagerOfAssignee =
    req.user.roles.pms === "manager" && assignment.assignedTo?.managerId?.equals(req.user._id);
  if (!isSelf && !isHr && !isManagerOfAssignee) {
    return res.status(403).json({ message: "Forbidden" });
  }

  res.json(assignment);
};

export const assignToUser = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const { cycleId, templateId, userId, kras } = req.body;
  if (!cycleId || !userId) return res.status(400).json({ message: "cycleId and userId are required" });

  const assignment = await KraAssignment.create({
    cycleId,
    templateId: templateId || null,
    assignedTo: userId,
    kras: kras || [],
    createdBy: req.user._id,
  });
  res.status(201).json(assignment);
};

// Mirrors the old system's group-expansion behavior: a group assignment
// becomes one KraAssignment document per member, not a single shared doc —
// group membership itself is not preserved relationally on the assignment.
export const assignToGroup = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const { cycleId, templateId, groupId, kras } = req.body;
  if (!cycleId || !groupId) return res.status(400).json({ message: "cycleId and groupId are required" });

  const group = await UsersGroup.findById(groupId);
  if (!group) return res.status(404).json({ message: "Group not found" });

  const assignments = await KraAssignment.insertMany(
    group.members.map((userId) => ({
      cycleId,
      templateId: templateId || null,
      assignedTo: userId,
      kras: kras || [],
      createdBy: req.user._id,
    })),
  );
  res.status(201).json(assignments);
};

export const updateAssignment = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const { kras, status } = req.body;
  const assignment = await KraAssignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ message: "Assignment not found" });

  if (kras !== undefined) assignment.kras = kras;
  if (status !== undefined) assignment.status = status;
  assignment.updatedBy = req.user._id;
  await assignment.save();
  res.json(assignment);
};

export const deleteAssignment = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const assignment = await KraAssignment.findByIdAndDelete(req.params.id);
  if (!assignment) return res.status(404).json({ message: "Assignment not found" });
  res.status(204).send();
};
