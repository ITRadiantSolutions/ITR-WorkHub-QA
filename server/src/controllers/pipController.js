import Pip from "../models/Pip.js";
import Timesheet from "../models/Timesheet.js";
import User from "../models/User.js";
import { createReadUrl, uploadAttachment } from "../config/blobStorage.js";

const requirePmsManagerOrHr = (req, res) => {
  if (!["manager", "hr"].includes(req.user.roles.pms)) {
    res.status(403).json({ message: "Forbidden" });
    return false;
  }
  return true;
};

const ALLOWED_PROOF_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

// Resolves an employee's manager via their most recently submitted timesheet
// rather than User.managerId — the two can disagree (a timesheet's manager
// reflects who actually approved their hours), and that's what a PIP's
// review chain should follow.
export const getPipEmployeeManager = async (req, res) => {
  const isSelf = req.params.employeeId === req.user._id.toString();
  if (!isSelf && !["hr", "manager"].includes(req.user.roles.pms)) {
    return res.status(403).json({ message: "Not authorized to view this employee's manager" });
  }
  const timesheet = await Timesheet.findOne({ userId: req.params.employeeId, managerId: { $ne: null } }).sort({ submittedAt: -1 });
  if (!timesheet?.managerId) {
    return res.status(404).json({ message: "No manager relationship found. Ask the employee to submit a timesheet first." });
  }
  const manager = await User.findById(timesheet.managerId).select("name email");
  if (!manager) return res.status(404).json({ message: "No manager relationship found. Ask the employee to submit a timesheet first." });
  res.json({ id: manager._id, name: manager.name, email: manager.email });
};

// Confirms the blob actually belongs to a PIP goal before signing a URL for
// it, and that the requester can access that PIP (self, or manager/hr).
export const getProofUrl = async (req, res) => {
  const blobName = req.query.blob_name;
  if (!blobName) return res.status(400).json({ message: "blob_name is required" });

  const pip = await Pip.findOne({ "goals.proofDocuments.blobName": blobName });
  if (!pip) return res.status(404).json({ message: "Proof document not found" });
  const isSelf = pip.employeeId.equals(req.user._id);
  if (!isSelf && !["hr", "manager"].includes(req.user.roles.pms)) {
    return res.status(403).json({ message: "Not authorized to view this document" });
  }

  res.json({ url: createReadUrl(blobName) });
};

export const listPips = async (req, res) => {
  const filter = {};
  if (req.query.employeeId) filter.employeeId = req.query.employeeId;
  if (req.query.status) filter.status = req.query.status;

  if (req.user.roles.pms === "employee") filter.employeeId = req.user._id;

  res.json(await Pip.find(filter).populate("employeeId", "name email"));
};

export const getPip = async (req, res) => {
  const pip = await Pip.findById(req.params.id).populate("employeeId", "name email");
  if (!pip) return res.status(404).json({ message: "PIP not found" });
  if (req.user.roles.pms === "employee" && !pip.employeeId.equals(req.user._id)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  res.json(pip);
};

export const createPip = async (req, res) => {
  if (!requirePmsManagerOrHr(req, res)) return;
  const { employeeId, status, outcome, startDate, targetEndDate, reason, reviewNotes, goals } = req.body;
  if (!employeeId || !startDate || !targetEndDate) {
    return res.status(400).json({ message: "employeeId, startDate and targetEndDate are required" });
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
  res.status(201).json(pip);
};

export const updatePip = async (req, res) => {
  if (!requirePmsManagerOrHr(req, res)) return;
  const { status, outcome, reviewNotes, startDate, targetEndDate, reason, goals } = req.body;

  const pip = await Pip.findById(req.params.id);
  if (!pip) return res.status(404).json({ message: "PIP not found" });

  if (status !== undefined) pip.status = status;
  if (outcome !== undefined) pip.outcome = outcome;
  if (reviewNotes !== undefined) pip.reviewNotes = reviewNotes;
  if (startDate !== undefined) pip.startDate = startDate;
  if (targetEndDate !== undefined) pip.targetEndDate = targetEndDate;
  if (reason !== undefined) pip.reason = reason;
  if (goals !== undefined) pip.goals = goals;
  pip.updatedBy = req.user._id;
  // Manager/HR reviewing the PIP re-opens the employee's ability to submit
  // another goal-progress update.
  pip.employeeSubmitted = false;

  await pip.save();
  res.json(pip);
};

// Accepts either plain JSON ({ goals }) or multipart/form-data (managerEmail,
// goalUpdates as a JSON string, and files named proof_{goalIndex}_{fileIndex}
// for goal proof documents) — the route applies multer's upload.any() so
// req.files is populated whenever the client sends multipart.
export const employeeSubmitPip = async (req, res) => {
  const pip = await Pip.findById(req.params.id);
  if (!pip) return res.status(404).json({ message: "PIP not found" });
  if (!pip.employeeId.equals(req.user._id)) return res.status(403).json({ message: "Forbidden" });
  if (pip.employeeSubmitted) {
    return res.status(409).json({ message: "Update already submitted — waiting on manager review" });
  }

  if (req.body.goalUpdates !== undefined) {
    let goalUpdates = [];
    try {
      goalUpdates = JSON.parse(req.body.goalUpdates || "[]");
    } catch {
      return res.status(400).json({ message: "Invalid goalUpdates payload" });
    }

    const invalidFile = (req.files || []).find((f) => !ALLOWED_PROOF_MIME_TYPES.includes(f.mimetype));
    if (invalidFile) {
      return res.status(400).json({ message: `Unsupported file type: ${invalidFile.mimetype}. Only PDF, JPEG, and PNG are allowed.` });
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
    pip.submittedManagerName = req.body.managerEmail || pip.submittedManagerName;
  } else {
    pip.goals = req.body.goals || pip.goals;
  }

  pip.employeeSubmitted = true;
  await pip.save();
  res.json(pip);
};

export const deletePip = async (req, res) => {
  if (!requirePmsManagerOrHr(req, res)) return;
  const pip = await Pip.findByIdAndDelete(req.params.id);
  if (!pip) return res.status(404).json({ message: "PIP not found" });
  res.status(204).send();
};
