import Kra from "../models/Kra.js";
import Kpi from "../models/Kpi.js";
import KraAssignment from "../models/KraAssignment.js";

// Ports ITR_TimeFlow_Production's app/pms/pms_kra.py — an employee's
// self-service KRA/KPI drafting workspace (separate `kras`/`kpis`
// collections there), independent of the HR/manager-assigned
// KraDefinition/KraAssignment flow.

export const createDraftKra = async (req, res) => {
  const { userId, name, weight, cycleId } = req.body;
  if (!userId || !name || weight === undefined) {
    return res.status(400).json({ message: "userId, name and weight are required" });
  }
  const kra = await Kra.create({ userId, name, weight, cycleId: cycleId || null });
  res.status(201).json({ id: kra._id, userId, name, weight, cycleId: cycleId || null, kpis: [] });
};

export const listDraftKras = async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ message: "userId is required" });

  const kras = await Kra.find({ userId, status: "draft" });
  const kpisByKra = new Map();
  const kpis = await Kpi.find({ kraId: { $in: kras.map((k) => k._id) } });
  for (const kpi of kpis) {
    const list = kpisByKra.get(kpi.kraId.toString()) || [];
    list.push({ id: kpi._id, kraId: kpi.kraId, userId: kpi.userId, title: kpi.title, description: kpi.description, weight: kpi.weight });
    kpisByKra.set(kpi.kraId.toString(), list);
  }

  res.json(
    kras.map((k) => ({
      id: k._id,
      userId: k.userId,
      cycleId: k.cycleId,
      name: k.name,
      weight: k.weight,
      status: k.status,
      created_at: k.created_at,
      kpis: kpisByKra.get(k._id.toString()) || [],
    })),
  );
};

export const addDraftKpi = async (req, res) => {
  const { kraId, userId, title, description, weight } = req.body;
  if (!kraId || !userId || !title || weight === undefined) {
    return res.status(400).json({ message: "kraId, userId, title and weight are required" });
  }
  const kpi = await Kpi.create({ kraId, userId, title, description: description || "", weight });
  res.status(201).json({ id: kpi._id, kraId, userId, title, description: description || "", weight });
};

// Publishes the employee's current draft KRAs as a KraAssignment (the home
// ITR_TimeFlow_Production's `templates` collection was folded into for this
// per-user-per-cycle shape — see KraAssignment.js), then clears the drafts.
export const submitDraftTemplate = async (req, res) => {
  const { userId, kras, cycleId } = req.body;
  if (!userId) return res.status(400).json({ message: "userId is required" });
  if (!cycleId) return res.status(400).json({ message: "cycleId is required" });

  await KraAssignment.create({
    cycleId,
    assignedTo: userId,
    kras: (kras || []).map((k) => ({ name: k.name, type: k.type || "functional", weight: k.weight, kpis: k.kpis || [] })),
    status: "submitted",
    submittedAt: new Date(),
  });

  const draftKras = await Kra.find({ userId, status: "draft" });
  await Kpi.deleteMany({ kraId: { $in: draftKras.map((k) => k._id) } });
  await Kra.deleteMany({ userId, status: "draft" });

  res.json({ success: true, message: "Template submitted successfully!" });
};

// The employee's previously-submitted templates for a cycle — same data
// KraAssignment already serves via GET /kpi-template/assigned/:employeeId,
// exposed here too for parity with the old /api/kras/templates/{userId} path.
export const listSubmittedTemplates = async (req, res) => {
  const assignments = await KraAssignment.find({ assignedTo: req.params.userId });
  res.json(
    assignments.map((a) => ({
      id: a._id,
      userId: a.assignedTo,
      cycleId: a.cycleId,
      kras: a.kras,
      status: a.status,
      submittedAt: a.submittedAt,
    })),
  );
};

export const clearDraftKras = async (req, res) => {
  const draftKras = await Kra.find({ userId: req.params.userId, status: "draft" });
  await Kpi.deleteMany({ kraId: { $in: draftKras.map((k) => k._id) } });
  await Kra.deleteMany({ userId: req.params.userId, status: "draft" });
  res.json({ success: true, message: "All KRAs & KPIs cleared for user" });
};
