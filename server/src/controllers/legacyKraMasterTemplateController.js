import KraDefinition from "../models/KraDefinition.js";
import KraAssignment from "../models/KraAssignment.js";
import User from "../models/User.js";

const requirePmsHrOrManager = (req, res) => {
  if (!["hr", "manager"].includes(req.user.roles.pms)) {
    res.status(403).json({ message: "PMS HR/Manager access required" });
    return false;
  }
  return true;
};

const kraJson = (k) => ({
  id: k._id.toString(),
  name: k.name,
  type: k.type,
  weight: k.weight,
  kpis: (k.kpis || []).map((kpi) => ({ name: kpi.title || kpi.name, title: kpi.title || kpi.name, weight: kpi.weight })),
});

const serializeMasterTemplate = async (doc) => {
  const assignedUsers = await KraAssignment.find({ templateId: doc._id }).distinct("assignedTo");
  return {
    id: doc._id.toString(),
    name: doc.name,
    functionalKras: doc.kras.filter((k) => k.type === "functional").map(kraJson),
    organizationalKras: doc.kras.filter((k) => k.type === "organizational").map(kraJson),
    assignedUsers,
  };
};

export const listMasterTemplates = async (req, res) => {
  const docs = await KraDefinition.find({ scope: "master_template" });
  res.json(await Promise.all(docs.map(serializeMasterTemplate)));
};

const toEntries = (kras = [], type) =>
  kras.map((k) => ({
    name: k.name,
    type,
    weight: k.weight || 0,
    kpis: (k.kpis || []).map((kpi) => ({ title: kpi.name || kpi.title, weight: kpi.weight })),
  }));

export const createMasterTemplate = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const { name, functionalKras, organizationalKras } = req.body;
  if (!name) return res.status(400).json({ message: "name is required" });

  const doc = await KraDefinition.create({
    scope: "master_template",
    name,
    kras: [...toEntries(functionalKras, "functional"), ...toEntries(organizationalKras, "organizational")],
    createdBy: req.user._id,
  });
  res.status(201).json(await serializeMasterTemplate(doc));
};

export const updateMasterTemplate = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const { name, functionalKras, organizationalKras } = req.body;

  const doc = await KraDefinition.findOne({ _id: req.params.id, scope: "master_template" });
  if (!doc) return res.status(404).json({ message: "Template not found" });

  if (name !== undefined) doc.name = name;
  if (functionalKras !== undefined || organizationalKras !== undefined) {
    doc.kras = [...toEntries(functionalKras, "functional"), ...toEntries(organizationalKras, "organizational")];
  }
  await doc.save();
  res.json(await serializeMasterTemplate(doc));
};

export const deleteMasterTemplate = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const doc = await KraDefinition.findOneAndDelete({ _id: req.params.id, scope: "master_template" });
  if (!doc) return res.status(404).json({ message: "Template not found" });
  res.status(204).send();
};

// "Unassigned" in the original meant "not yet given a KRA assignment for the
// current cycle" — we simplify to "every active user" since cycle-scoped
// assignment tracking isn't precise enough yet to filter further.
export const listUnassignedAssignees = async (req, res) => {
  const users = await User.find({ "archived.pms": false }).select("name roles");
  res.json(users.map((u) => ({ id: u._id, name: u.name, type: "user" })));
};

const buildAssignmentKras = (kras = []) =>
  kras.map((k) => ({
    name: k.name,
    type: k.type || "functional",
    weight: Number(k.weight) || 0,
    kpis: (k.kpis || []).map((kpi) => ({ title: kpi.name || kpi.title, weight: Number(kpi.weight) || 0 })),
    isEmployeeAdded: false,
  }));

// HR/manager assigns a saved master template (or ad-hoc KRAs) to one or more
// users, creating one KraAssignment per assignee.
export const submitKpiTemplateAssignment = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const { templateId, assignees, kras } = req.body;
  if (!Array.isArray(assignees) || !assignees.length) {
    return res.status(400).json({ message: "assignees[] is required" });
  }

  const created = await KraAssignment.insertMany(
    assignees.map((a) => ({
      templateId: templateId || null,
      assignedTo: a.id,
      kras: buildAssignmentKras(kras),
      status: "draft",
      createdBy: req.user._id,
    })),
  );
  res.status(201).json(created);
};

const findAssignmentForUser = (userId) => KraAssignment.findOne({ assignedTo: userId }).sort({ createdAt: -1 });

export const updateKpiTemplateAssignment = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const { assignedToId, kras } = req.body;

  const assignment = await findAssignmentForUser(assignedToId);
  if (!assignment) return res.status(404).json({ message: "Assignment not found" });

  assignment.kras = buildAssignmentKras(kras);
  assignment.updatedBy = req.user._id;
  await assignment.save();
  res.json(assignment);
};

export const updateKpiTemplateForUser = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const assignment = await findAssignmentForUser(req.params.userId);
  if (!assignment) return res.status(404).json({ message: "Assignment not found" });

  assignment.kras = buildAssignmentKras(req.body.kras);
  assignment.updatedBy = req.user._id;
  await assignment.save();
  res.json(assignment);
};

export const getAssignmentByAssignee = async (req, res) => {
  const { assignedToId } = req.query;
  if (!assignedToId) return res.status(400).json({ message: "assignedToId is required" });

  const assignment = await findAssignmentForUser(assignedToId);
  if (!assignment) return res.json(null);
  res.json({ id: assignment._id, kras: assignment.kras.map(kraJson), status: assignment.status });
};
