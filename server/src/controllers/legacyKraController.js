import KraDefinition from "../models/KraDefinition.js";
import KraAssignment from "../models/KraAssignment.js";
import Submission from "../models/Submission.js";
import User from "../models/User.js";

const requirePmsHrOrManager = (req, res) => {
  if (!["hr", "manager"].includes(req.user.roles.pms)) {
    res.status(403).json({ message: "PMS HR/Manager access required" });
    return false;
  }
  return true;
};

// Distinguishes an HR/manager-assigned ("base") KRA from an employee-drafted
// one in the flat kraId string the original frontend expects — it filters
// employee-only KRAs with `!kraId.includes("-base-")`.
const baseKraId = (assignmentId, kraSubId) => `${assignmentId}-base-${kraSubId}`;

const serializeKpisForLibrary = (kpis = []) =>
  kpis.map((kpi, i) => ({ id: kpi._id?.toString() || `kpi-${i}`, name: kpi.title || kpi.name || "" }));

// ─────────────────────────── KRA library ───────────────────────────
export const listKraLibrary = async (req, res) => {
  const docs = await KraDefinition.find({ scope: "library" });
  const flat = [];
  for (const doc of docs) {
    for (const k of doc.kras) {
      flat.push({ id: k._id.toString(), name: k.name, type: k.type || doc.type, kpis: serializeKpisForLibrary(k.kpis) });
    }
  }
  res.json(flat);
};

export const createKraLibraryEntries = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const { type, kras } = req.body;
  if (!type || !Array.isArray(kras) || !kras.length) {
    return res.status(400).json({ message: "type and kras[] are required" });
  }

  const doc = await KraDefinition.findOneAndUpdate(
    { scope: "library", type },
    { $setOnInsert: { scope: "library", type, createdBy: req.user._id } },
    { new: true, upsert: true },
  );

  for (const kra of kras) {
    doc.kras.push({
      name: kra.name,
      type,
      kpis: (kra.kpis || []).map((kpi) => ({ title: kpi.name })),
    });
  }
  await doc.save();
  res.status(201).json({ message: "KRA created" });
};

export const updateKraLibraryEntry = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const { kraId } = req.params;
  const { name, kpis, type } = req.body;

  const doc = await KraDefinition.findOne({ scope: "library", "kras._id": kraId });
  if (!doc) return res.status(404).json({ message: "KRA not found" });

  const inUse = await KraAssignment.exists({ "kras.defRef": kraId });
  if (inUse) {
    return res.status(400).json({ detail: "This KRA is already used in a template and cannot be edited." });
  }

  const entry = doc.kras.id(kraId);
  if (name !== undefined) entry.name = name;
  if (type !== undefined) entry.type = type;
  if (kpis !== undefined) entry.kpis = kpis.map((kpi) => ({ title: kpi.name }));
  await doc.save();
  res.json({ message: "KRA updated" });
};

export const deleteKraLibraryEntry = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const { kraId } = req.params;

  const inUse = await KraAssignment.exists({ "kras.defRef": kraId });
  if (inUse) {
    return res.status(400).json({ detail: "Cannot delete. This KRA is already used in a template." });
  }

  const doc = await KraDefinition.findOne({ scope: "library", "kras._id": kraId });
  if (!doc) return res.status(404).json({ message: "KRA not found" });
  doc.kras.pull(kraId);
  await doc.save();
  res.status(204).send();
};

// ─────────────────────────── Managers ───────────────────────────
export const listPmsManagers = async (req, res) => {
  const users = await User.find({ "roles.pms": "manager" }).select("name email");
  res.json(users.map((u) => ({ id: u._id, _id: u._id, name: u.name, email: u.email })));
};

export const getEmployeeManager = async (req, res) => {
  const user = await User.findById(req.params.employeeId).populate("managerId", "name email");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user.managerId ? { id: user.managerId._id, name: user.managerId.name, email: user.managerId.email } : null);
};

// ─────────────────────────── Assignments ("kpi-template") ───────────────────────────
export const listAssignedTemplates = async (req, res) => {
  const assignments = await KraAssignment.find({ assignedTo: req.params.employeeId });
  res.json(
    assignments.map((a) => ({
      _id: a._id,
      cycleId: a.cycleId,
      status: a.status,
      kras: a.kras
        .filter((k) => !k.isEmployeeAdded)
        .map((k) => ({ kraId: baseKraId(a._id, k._id), name: k.name, weight: k.weight, kpis: k.kpis })),
    })),
  );
};

export const deleteAssignment = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const assignment = await KraAssignment.findByIdAndDelete(req.params.id);
  if (!assignment) return res.status(404).json({ message: "Template not found" });
  res.status(204).send();
};

// EditTemplate.jsx's "template" here is actually one KraAssignment — it edits
// the weight distribution across an already-assigned set of KRAs/KPIs.
export const getAssignmentSingle = async (req, res) => {
  const assignment = await KraAssignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ message: "Template not found" });
  res.json({
    id: assignment._id,
    kras: assignment.kras.map((k) => ({
      id: k._id,
      name: k.name,
      weight: k.weight,
      kpis: (k.kpis || []).map((kpi) => ({ name: kpi.title || kpi.name, weight: kpi.weight })),
    })),
  });
};

export const updateAssignmentWeights = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const assignment = await KraAssignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ message: "Template not found" });

  for (const kra of req.body.kras || []) {
    const target = assignment.kras.id(kra.id);
    if (!target) continue;
    target.weight = kra.weight;
    target.kpis = (kra.kpis || []).map((kpi, i) => ({
      ...target.kpis[i]?.toObject(),
      title: kpi.name || kpi.title,
      weight: kpi.weight,
    }));
  }
  assignment.updatedBy = req.user._id;
  await assignment.save();
  res.json({ message: "Template updated" });
};

// Employees pick from HR-curated master templates to add those KRAs to
// their own current-cycle assignment.
export const assignTemplatesToSelf = async (req, res) => {
  const { templateIds } = req.body;
  if (!Array.isArray(templateIds) || !templateIds.length) {
    return res.status(400).json({ message: "templateIds[] is required" });
  }

  const masterTemplates = await KraDefinition.find({ _id: { $in: templateIds }, scope: "master_template" });
  const activeCycleAssignment = await KraAssignment.findOne({ assignedTo: req.user._id }).sort({ createdAt: -1 });
  if (!activeCycleAssignment) {
    return res.status(400).json({ message: "No active KRA assignment found for the current cycle" });
  }

  for (const template of masterTemplates) {
    for (const kra of template.kras) {
      activeCycleAssignment.kras.push({
        defRef: kra.originalId,
        name: kra.name,
        type: kra.type,
        weight: 0,
        kpis: kra.kpis,
        isEmployeeAdded: true,
      });
    }
  }
  await activeCycleAssignment.save();
  res.json({ message: "Templates assigned successfully" });
};

// ─────────────────────────── KRA fill-out / submission ───────────────────────────

const buildKraViewModel = (assignment, submission) => {
  const responseBySubId = new Map();
  (submission?.kraResponses || []).forEach((r) => {
    if (r.kraId) responseBySubId.set(r.kraId.toString(), r);
  });

  const toKraJson = (k) => {
    const r = responseBySubId.get(k._id.toString());
    const kraId = k.isEmployeeAdded ? k._id.toString() : baseKraId(assignment._id, k._id);
    return {
      kraId,
      _id: k._id,
      name: k.name,
      weight: k.weight,
      kpis: (k.kpis || []).map((kpi, i) => ({
        title: kpi.title || kpi.name,
        name: kpi.title || kpi.name,
        weight: kpi.weight,
        actual: r?.kpis?.[i]?.actual ?? kpi.actual ?? "",
        target: r?.kpis?.[i]?.target ?? kpi.target ?? "",
      })),
    };
  };

  const responses = {};
  const ratings = {};
  for (const k of assignment.kras) {
    const r = responseBySubId.get(k._id.toString());
    if (!r) continue;
    const kraId = k.isEmployeeAdded ? k._id.toString() : baseKraId(assignment._id, k._id);
    responses[kraId] = r.response || "";
    ratings[kraId] = r.rating ?? null;
  }

  return {
    exists: true,
    kras: assignment.kras.map(toKraJson),
    responses,
    ratings,
    status: submission?.status || assignment.status || "draft",
    kraStatuses: {},
  };
};

export const getByTemplate = async (req, res) => {
  const { templateId, employeeId } = req.params;
  const assignment = await KraAssignment.findById(templateId);
  if (!assignment) return res.json({ exists: false });

  const submission = await Submission.findOne({ assignmentId: templateId, employeeId });
  res.json(buildKraViewModel(assignment, submission));
};

// Shared by /kra/draft, /kra/submit, /reports/employee-submit — they all
// sync the employee's current working state to the backend, differing only
// in what status results.
async function upsertSubmissionFromPayload({ templateId, employeeId, managerId, kras }, status) {
  const assignment = await KraAssignment.findById(templateId);
  if (!assignment) throw Object.assign(new Error("Template not found"), { status: 404 });

  // Persist any newly-drafted employee KRAs onto the assignment itself
  // (kras[] whose id isn't one of the assignment's existing subdocument ids).
  const existingIds = new Set(assignment.kras.map((k) => k._id.toString()));
  for (const kra of kras || []) {
    const rawId = String(kra.id || kra.kraId || "");
    const isBase = rawId.includes("-base-");
    if (isBase || existingIds.has(rawId)) continue;
    assignment.kras.push({
      name: kra.name,
      weight: kra.weight || 0,
      kpis: (kra.kpis || []).map((kpi) => ({ title: kpi.title || kpi.name, weight: kpi.weight })),
      isEmployeeAdded: true,
    });
  }
  await assignment.save();

  const bySubId = new Map(assignment.kras.map((k) => [k._id.toString(), k]));
  const resolveSubId = (rawId) => {
    if (rawId.includes("-base-")) return rawId.split("-base-").pop();
    if (bySubId.has(rawId)) return rawId;
    // Newly-created employee KRA: match by name (just persisted above, no
    // reliable id from the frontend for it yet).
    return null;
  };

  const kraResponses = (kras || []).map((kra) => {
    const rawId = String(kra.id || kra.kraId || "");
    const subId = resolveSubId(rawId) || [...bySubId.values()].find((k) => k.name === kra.name)?._id?.toString();
    return {
      kraId: subId || null,
      kraName: kra.name,
      weight: kra.weight,
      kpis: kra.kpis || [],
      response: kra.response || "",
      rating: kra.rating || null,
    };
  });

  const submission = await Submission.findOneAndUpdate(
    { assignmentId: templateId, employeeId },
    {
      $set: {
        cycleId: assignment.cycleId,
        assignmentId: templateId,
        employeeId,
        managerId: managerId || undefined,
        status,
        kraResponses,
      },
    },
    { new: true, upsert: true },
  );

  if (status !== "draft") {
    assignment.status = status;
    await assignment.save();
  }

  return submission;
}

export const saveKraDraft = async (req, res) => {
  try {
    await upsertSubmissionFromPayload(req.body, "draft");
    res.json({ message: "Draft saved" });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

export const submitKra = async (req, res) => {
  try {
    await upsertSubmissionFromPayload(req.body, "pending_manager_approval");
    res.json({ message: "Submitted for approval" });
  } catch (error) {
    res.status(error.status || 500).json({ detail: error.message });
  }
};

export const submitEmployeeReview = async (req, res) => {
  try {
    const existing = await Submission.findOne({ assignmentId: req.body.templateId, employeeId: req.body.employeeId });
    const nextStatus = existing?.status === "manager_reviewed" ? "final_employee_submitted" : "employee_submitted";
    await upsertSubmissionFromPayload(req.body, nextStatus);
    res.json({ message: "Self review submitted" });
  } catch (error) {
    res.status(error.status || 500).json({ detail: error.message });
  }
};

// UserKraSearch.jsx's combined "user + their KRA assignment summary" search,
// used both for the full user list and for a single-user lookup (name=exact).
export const searchUserWithKra = async (req, res) => {
  const { name, archived } = req.query;

  const userFilter = { "archived.pms": archived === "true" };
  if (name?.trim()) userFilter.name = { $regex: name.trim(), $options: "i" };

  const users = await User.find(userFilter).select("name email roles managerId").populate("managerId", "name");
  const assignments = await KraAssignment.find({ assignedTo: { $in: users.map((u) => u._id) } })
    .populate("createdBy", "name")
    .sort({ createdAt: -1 });

  const byUser = new Map();
  for (const a of assignments) {
    if (!byUser.has(a.assignedTo.toString())) byUser.set(a.assignedTo.toString(), []);
    byUser.get(a.assignedTo.toString()).push(a);
  }

  res.json(
    users.map((u) => {
      const userAssignments = byUser.get(u._id.toString()) || [];
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.roles.pms,
        hasKRA: userAssignments.length > 0,
        kras: userAssignments.map((a) => ({ assignedAt: a.createdAt, assignedBy: a.createdBy?.name || null })),
        manager_id: u.managerId?._id || null,
        manager_name: u.managerId?.name || null,
      };
    }),
  );
};

export const saveActual = async (req, res) => {
  const { templateId, employeeId, kraId, kpiIndex, actual } = req.body;
  const subId = String(kraId).includes("-base-") ? String(kraId).split("-base-").pop() : kraId;

  const submission = await Submission.findOne({ assignmentId: templateId, employeeId });
  if (!submission) return res.status(404).json({ message: "Submission not found" });

  const response = submission.kraResponses.find((r) => r.kraId?.toString() === subId);
  if (!response) return res.status(404).json({ message: "KRA response not found" });

  response.kpis[kpiIndex] = { ...(response.kpis[kpiIndex] || {}), actual };
  submission.markModified("kraResponses");
  await submission.save();
  res.json({ message: "Saved" });
};
