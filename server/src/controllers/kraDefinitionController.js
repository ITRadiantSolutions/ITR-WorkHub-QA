import KraDefinition from "../models/KraDefinition.js";
import KraAssignment from "../models/KraAssignment.js";
import { escapeRegex } from "../utils/taskFilters.js";

const requirePmsHr = (req, res) => {
  if (req.user.roles.pms !== "hr") {
    res.status(403).json({ message: "PMS HR access required" });
    return false;
  }
  return true;
};

// --- Library (scope="library") — one doc per type, holding the raw KRA catalog ---

export const listLibrary = async (req, res) => {
  const filter = { scope: "library" };
  if (req.query.type) filter.type = req.query.type;
  res.json(await KraDefinition.find(filter));
};

export const addLibraryKra = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const { type, name, kpis } = req.body;
  if (!type || !name) return res.status(400).json({ message: "type and name are required" });

  const doc = await KraDefinition.findOneAndUpdate(
    { scope: "library", type },
    { $setOnInsert: { scope: "library", type, createdBy: req.user._id } },
    { new: true, upsert: true },
  );
  doc.kras.push({ name, type, kpis: kpis || [] });
  await doc.save();
  res.status(201).json(doc);
};

// Edits an existing library KRA's own KPI breakdown (title/description/weight
// per KPI) — this is the catalog entry itself, so the change is visible to
// every template that references this KRA going forward (already-created
// templates keep their own snapshotted kpis, same as addLibraryKra).
export const updateLibraryKra = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const { kpis } = req.body;
  if (!Array.isArray(kpis)) return res.status(400).json({ message: "kpis must be an array" });

  const namedKpis = kpis.filter((k) => k.title?.trim());
  if (namedKpis.some((k) => !(Number(k.weight) > 0))) {
    return res.status(400).json({ message: "Every KPI needs a weight greater than 0" });
  }
  const totalWeight = namedKpis.reduce((sum, k) => sum + (Number(k.weight) || 0), 0);
  if (namedKpis.length > 0 && totalWeight !== 100) {
    return res.status(400).json({ message: `KPI weights must add up to 100% (currently ${totalWeight}%)` });
  }

  const doc = await KraDefinition.findOne({ scope: "library", type: req.params.type });
  if (!doc) return res.status(404).json({ message: "Library catalog not found for this type" });
  const entry = doc.kras.id(req.params.kraId);
  if (!entry) return res.status(404).json({ message: "KRA not found" });

  entry.kpis = namedKpis.map((k) => ({
    title: k.title.trim(),
    description: (k.description || "").trim(),
    weight: Number(k.weight),
    target: k.target !== undefined && k.target !== "" ? k.target : null,
  }));
  await doc.save();
  res.json(doc);
};

export const removeLibraryKra = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const doc = await KraDefinition.findOne({ scope: "library", type: req.params.type });
  if (!doc) return res.status(404).json({ message: "Library catalog not found for this type" });

  doc.kras = doc.kras.filter((k) => k._id.toString() !== req.params.kraId);
  await doc.save();
  res.json(doc);
};

// --- Master templates (scope="master_template") — curated bundles referencing the library ---

export const listMasterTemplates = async (req, res) => {
  const templates = await KraDefinition.find({ scope: "master_template" }).sort({ createdAt: -1 });
  res.json(templates);
};

export const getMasterTemplate = async (req, res) => {
  const template = await KraDefinition.findOne({ _id: req.params.id, scope: "master_template" });
  if (!template) return res.status(404).json({ message: "Template not found" });

  const assignedUsers = await KraAssignment.find({ templateId: template._id }).distinct("assignedTo");
  res.json({ ...template.toObject(), assignedUsers });
};

// kraRefs: [{ libraryType, kraId, weight }] — resolves each ref against the
// current library catalog into an embedded KRA entry (name/type/kpis
// snapshotted at resolution time, same as create). `weight` is this KRA's
// suggested share of the template (0-100) — carried through so
// AssignTemplate.jsx can pre-fill per-KRA weights instead of leaving every
// assignment blank regardless of what the template itself specifies.
const resolveKraRefs = async (kraRefs) => {
  const libraryDocs = await KraDefinition.find({ scope: "library" });
  const resolved = [];
  for (const ref of kraRefs || []) {
    const libraryDoc = libraryDocs.find((d) => d.type === ref.libraryType);
    const entry = libraryDoc?.kras.id(ref.kraId);
    if (entry) {
      const weight = Number(ref.weight);
      resolved.push({
        originalId: entry._id,
        name: entry.name,
        type: entry.type,
        kpis: entry.kpis,
        weight: Number.isFinite(weight) ? weight : null,
      });
    }
  }
  return resolved;
};

// Case-insensitive — "Test" and "TEST" would otherwise both be allowed and
// be indistinguishable in every template picker (AssignTemplate.jsx, etc.).
const findDuplicateTemplateName = async (name, excludeId) => {
  const filter = { scope: "master_template", name: { $regex: `^${escapeRegex(name.trim())}$`, $options: "i" } };
  if (excludeId) filter._id = { $ne: excludeId };
  return KraDefinition.findOne(filter);
};

export const createMasterTemplate = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const { name, kraRefs } = req.body;
  if (!name) return res.status(400).json({ message: "name is required" });
  if (await findDuplicateTemplateName(name)) {
    return res.status(409).json({ message: `A template named "${name.trim()}" already exists` });
  }

  const template = await KraDefinition.create({
    scope: "master_template",
    name,
    kras: await resolveKraRefs(kraRefs),
    createdBy: req.user._id,
  });
  res.status(201).json(template);
};

export const updateMasterTemplate = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const { name, kraRefs } = req.body;
  const template = await KraDefinition.findOne({ _id: req.params.id, scope: "master_template" });
  if (!template) return res.status(404).json({ message: "Template not found" });

  if (name !== undefined && (await findDuplicateTemplateName(name, template._id))) {
    return res.status(409).json({ message: `A template named "${name.trim()}" already exists` });
  }

  if (name !== undefined) template.name = name;
  if (kraRefs !== undefined) template.kras = await resolveKraRefs(kraRefs);
  await template.save();
  res.json(template);
};

export const deleteMasterTemplate = async (req, res) => {
  if (!requirePmsHr(req, res)) return;
  const template = await KraDefinition.findOneAndDelete({ _id: req.params.id, scope: "master_template" });
  if (!template) return res.status(404).json({ message: "Template not found" });
  res.status(204).send();
};
