import Pip from "../models/Pip.js";

const requirePmsManagerOrHr = (req, res) => {
  if (!["manager", "hr"].includes(req.user.roles.pms)) {
    res.status(403).json({ message: "Forbidden" });
    return false;
  }
  return true;
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
  const { employeeId, startDate, targetEndDate, reason, goals } = req.body;
  if (!employeeId || !startDate || !targetEndDate) {
    return res.status(400).json({ message: "employeeId, startDate and targetEndDate are required" });
  }

  const pip = await Pip.create({
    employeeId,
    startDate,
    targetEndDate,
    reason,
    goals: goals || [],
    createdBy: req.user._id,
  });
  res.status(201).json(pip);
};

export const updatePip = async (req, res) => {
  if (!requirePmsManagerOrHr(req, res)) return;
  const { status, outcome, reviewNotes, targetEndDate, goals } = req.body;

  const pip = await Pip.findById(req.params.id);
  if (!pip) return res.status(404).json({ message: "PIP not found" });

  if (status !== undefined) pip.status = status;
  if (outcome !== undefined) pip.outcome = outcome;
  if (reviewNotes !== undefined) pip.reviewNotes = reviewNotes;
  if (targetEndDate !== undefined) pip.targetEndDate = targetEndDate;
  if (goals !== undefined) pip.goals = goals;
  pip.updatedBy = req.user._id;
  // Manager/HR reviewing the PIP re-opens the employee's ability to submit
  // another goal-progress update.
  pip.employeeSubmitted = false;

  await pip.save();
  res.json(pip);
};

export const employeeSubmitPip = async (req, res) => {
  const pip = await Pip.findById(req.params.id);
  if (!pip) return res.status(404).json({ message: "PIP not found" });
  if (!pip.employeeId.equals(req.user._id)) return res.status(403).json({ message: "Forbidden" });
  if (pip.employeeSubmitted) {
    return res.status(409).json({ message: "Update already submitted — waiting on manager review" });
  }

  pip.employeeSubmitted = true;
  pip.goals = req.body.goals || pip.goals;
  await pip.save();
  res.json(pip);
};

export const deletePip = async (req, res) => {
  if (!requirePmsManagerOrHr(req, res)) return;
  const pip = await Pip.findByIdAndDelete(req.params.id);
  if (!pip) return res.status(404).json({ message: "PIP not found" });
  res.status(204).send();
};
