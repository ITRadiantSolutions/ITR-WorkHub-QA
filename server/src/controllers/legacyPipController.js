import Pip from "../models/Pip.js";
import { createReadUrl, uploadAttachment } from "../config/blobStorage.js";

export const getProofUrl = async (req, res) => {
  const blobName = req.query.blob_name;
  if (!blobName) return res.status(400).json({ message: "blob_name is required" });
  res.json({ url: createReadUrl(blobName) });
};

export const listEmployeePips = async (req, res) => {
  const pips = await Pip.find({ employeeId: req.params.employeeId }).sort({ createdAt: -1 });
  res.json(pips.map((p) => ({ ...p.toObject(), id: p._id })));
};

// UserKraSearch.jsx's "all PIPs" list, keyed by `employee_id` (snake_case,
// matching the old system's field naming).
export const listAllPips = async (req, res) => {
  const pips = await Pip.find({}).sort({ createdAt: -1 });
  res.json(pips.map((p) => ({ ...p.toObject(), id: p._id, employee_id: p.employeeId })));
};

const requirePmsHrOrManager = (req, res) => {
  if (!["hr", "manager"].includes(req.user.roles.pms)) {
    res.status(403).json({ message: "PMS HR/Manager access required" });
    return false;
  }
  return true;
};

export const createPip = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const { employee_id: employeeId, status, outcome, startDate, targetEndDate, reason, reviewNotes, goals } = req.body;
  if (!employeeId || !startDate || !targetEndDate) {
    return res.status(400).json({ message: "employee_id, startDate and targetEndDate are required" });
  }

  const pip = await Pip.create({
    employeeId,
    status,
    outcome,
    startDate,
    targetEndDate,
    reason,
    reviewNotes,
    goals: goals || [],
    createdBy: req.user._id,
  });
  res.status(201).json({ ...pip.toObject(), id: pip._id });
};

export const updatePipLegacy = async (req, res) => {
  if (!requirePmsHrOrManager(req, res)) return;
  const pip = await Pip.findById(req.params.id);
  if (!pip) return res.status(404).json({ message: "PIP not found" });

  const { status, outcome, startDate, targetEndDate, reason, reviewNotes, goals } = req.body;
  if (status !== undefined) pip.status = status;
  if (outcome !== undefined) pip.outcome = outcome;
  if (startDate !== undefined) pip.startDate = startDate;
  if (targetEndDate !== undefined) pip.targetEndDate = targetEndDate;
  if (reason !== undefined) pip.reason = reason;
  if (reviewNotes !== undefined) pip.reviewNotes = reviewNotes;
  if (goals !== undefined) pip.goals = goals;
  pip.updatedBy = req.user._id;

  await pip.save();
  res.json({ ...pip.toObject(), id: pip._id });
};

// multipart/form-data: managerEmail, goalUpdates (JSON string), and files
// named proof_{goalIndex}_{fileIndex}.
export const employeeUpdatePip = async (req, res) => {
  const pip = await Pip.findById(req.params.id);
  if (!pip) return res.status(404).json({ message: "PIP not found" });
  if (!pip.employeeId.equals(req.user._id)) return res.status(403).json({ message: "Forbidden" });

  let goalUpdates = [];
  try {
    goalUpdates = JSON.parse(req.body.goalUpdates || "[]");
  } catch {
    return res.status(400).json({ message: "Invalid goalUpdates payload" });
  }

  for (const update of goalUpdates) {
    const goal = pip.goals[Number(update.index)];
    if (!goal) continue;

    if (update.progressStatus) goal.progressStatus = update.progressStatus;

    if (Array.isArray(update.removeProofPaths) && update.removeProofPaths.length) {
      goal.proofDocuments = goal.proofDocuments.filter((doc) => !update.removeProofPaths.includes(doc.blobName));
    }

    const files = (req.files || []).filter((f) => f.fieldname.startsWith(`proof_${update.index}_`));
    for (const file of files) {
      const uploaded = await uploadAttachment({
        buffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
        scope: "pips",
        parentId: pip._id.toString(),
      });
      goal.proofDocuments.push({ blobName: uploaded.blobName, fileName: file.originalname, uploadedAt: new Date() });
    }
  }

  pip.employeeSubmitted = true;
  pip.submittedManagerName = req.body.managerEmail || pip.submittedManagerName;
  await pip.save();
  res.json({ message: "PIP updated", pip });
};
