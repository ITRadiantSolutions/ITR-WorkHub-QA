import KraAssignment from "../models/KraAssignment.js";
import UsersGroup from "../models/UsersGroup.js";
import User from "../models/User.js";
import Submission from "../models/Submission.js";

const requirePmsHrOrManager = (req, res) => {
  if (!["hr", "manager"].includes(req.user.roles.pms)) {
    res.status(403).json({ message: "PMS Manager or HR access required" });
    return false;
  }
  return true;
};

// UserKraSearch.jsx's main table: every user matching a name filter, each
// annotated with whether they have KRA assignments and a flattened summary
// of those assignments — used to browse "who has what" rather than fetch
// one person's assignment by id.
export const searchUsers = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const { name, archived } = req.query;

  const userFilter = {};
  if (archived !== undefined) userFilter["archived.pms"] = archived === "true";
  if (name?.trim()) userFilter.name = { $regex: name.trim(), $options: "i" };

  const users = await User.find(userFilter).select("name email roles managerId").populate("managerId", "name");
  const assignments = await KraAssignment.find({ assignedTo: { $in: users.map((u) => u._id) } })
    .populate("createdBy", "name")
    .sort({ createdAt: -1 });

  const byUser = new Map();
  for (const a of assignments) {
    const key = a.assignedTo.toString();
    if (!byUser.has(key)) byUser.set(key, []);
    byUser.get(key).push(a);
  }

  res.json(
    users.map((u) => {
      const userAssignments = byUser.get(u._id.toString()) || [];
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.roles.pms,
        managerId: u.managerId?._id || null,
        managerName: u.managerId?.name || null,
        hasKRA: userAssignments.length > 0,
        assignments: userAssignments.map((a) => ({
          id: a._id,
          cycleId: a.cycleId,
          status: a.status,
          kras: a.kras,
          assignedAt: a.createdAt,
          assignedBy: a.createdBy?.name || null,
        })),
        // Flattened one-row-per-KRA view (each annotated with its parent
        // assignment's assignedAt/assignedBy) for callers that want a flat
        // list rather than grouping by assignment — mirrors how the old
        // system's search endpoint shaped this same data.
        kras: userAssignments.flatMap((a) =>
          (a.kras || []).map((k) => ({
            kraId: k._id,
            name: k.name,
            type: k.type,
            weight: k.weight,
            kpis: k.kpis,
            isEmployeeAdded: k.isEmployeeAdded,
            assignedAt: a.createdAt,
            assignedBy: a.createdBy?.name || null,
          })),
        ),
      };
    }),
  );
};

// Reporting-line picker in UserKraSearch.jsx — HR can be someone's reporting
// manager too, not just users holding the "manager" tier.
export const listPmsManagers = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const managers = await User.find({ "roles.pms": { $in: ["manager", "hr"] } }).select("name email roles.pms");
  res.json(managers.map((u) => ({ id: u._id, name: u.name, email: u.email, role: u.roles.pms })));
};

// Name autocomplete for the assign-KRA search box.
export const searchUserSuggestions = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const { name } = req.query;
  const users = await User.find({ name: { $regex: name || "", $options: "i" }, "archived.pms": { $ne: true } })
    .select("name")
    .limit(20);
  res.json(users.map((u) => u.name));
};

export const listAssignments = async (req, res) => {
  const filter = {};
  if (req.query.cycleId) filter.cycleId = req.query.cycleId;

  if (req.user.roles.pms === "hr") {
    if (req.query.userId) filter.assignedTo = req.query.userId;
  } else if (req.user.roles.pms === "manager" && req.query.userId) {
    // A manager may only look up their own assignments or a direct report's
    // — the userId query param must never be trusted blindly (IDOR).
    const isSelf = req.query.userId === req.user._id.toString();
    const target = isSelf ? null : await User.findById(req.query.userId).select("managerId");
    const isOwnReport = target?.managerId?.toString() === req.user._id.toString();
    if (!isSelf && !isOwnReport) return res.status(403).json({ message: "Forbidden" });
    filter.assignedTo = req.query.userId;
  } else {
    filter.assignedTo = req.user._id;
  }

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
  if (!requirePmsHrOrManager(req, res)) return;
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
  if (!requirePmsHrOrManager(req, res)) return;
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
  if (!requirePmsHrOrManager(req, res)) return;
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
  if (!requirePmsHrOrManager(req, res)) return;
  const assignment = await KraAssignment.findByIdAndDelete(req.params.id);
  if (!assignment) return res.status(404).json({ message: "Assignment not found" });
  res.status(204).send();
};

// Employee self-review "negotiate your own KRA" step. Mints a real
// subdocument _id on assignment.kras[] and, if a Submission already exists
// for this assignment (getOrCreateFromAssignment already ran), appends a
// matching kraResponses[] row in the same request — the two ways this used
// to go out of sync (a client-side placeholder id sent before the server
// had minted a real one) are why this is a dedicated endpoint instead of
// happening client-side.
//
// Simplification vs. the legacy flow: employee-added KRAs go straight into
// the same submission as "pending" rather than needing a separate manager
// pre-approval step. That gate existed in the old system but nothing ever
// actually flipped the status it depended on, so it was unreachable in
// practice — here the manager reviews/rates ad-hoc KRAs together with
// everything else during the normal review round instead.
export const addEmployeeKra = async (req, res) => {
  const assignment = await KraAssignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ message: "Assignment not found" });
  if (!assignment.assignedTo.equals(req.user._id)) return res.status(403).json({ message: "Forbidden" });

  const { name, type, weight, kpis } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: "name is required" });

  assignment.kras.push({
    name: name.trim(),
    type: ["functional", "organizational"].includes(type) ? type : "functional",
    weight: Number(weight) || 0,
    kpis: kpis || [],
    isEmployeeAdded: true,
  });
  await assignment.save();
  const kra = assignment.kras[assignment.kras.length - 1];

  const submission = await Submission.findOne({ assignmentId: assignment._id, employeeId: req.user._id });
  if (submission) {
    submission.kraResponses.push({ kraId: kra._id, kraName: kra.name, weight: kra.weight, kpis: kra.kpis });
    await submission.save();
  }

  res.status(201).json({ assignment, kra });
};

// Only ever the employee's own not-yet-reviewed ad-hoc KRAs — HR/manager-
// assigned KRAs aren't removable here.
export const removeEmployeeKra = async (req, res) => {
  const assignment = await KraAssignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ message: "Assignment not found" });
  if (!assignment.assignedTo.equals(req.user._id)) return res.status(403).json({ message: "Forbidden" });

  const kra = assignment.kras.id(req.params.kraId);
  if (!kra || !kra.isEmployeeAdded) return res.status(404).json({ message: "KRA not found" });
  kra.deleteOne();
  await assignment.save();

  const submission = await Submission.findOne({ assignmentId: assignment._id, employeeId: req.user._id });
  if (submission) {
    submission.kraResponses = submission.kraResponses.filter((r) => String(r.kraId) !== req.params.kraId);
    await submission.save();
  }

  res.status(204).send();
};
