import Offboarding from "../models/Offboarding.js";
import AssetAssignment from "../models/AssetAssignment.js";
import User from "../models/User.js";
import { writeAuditLog } from "../utils/activityLog.js";
import { notifyUsers } from "../utils/notify.js";
import { sendHrmsEmail } from "../utils/hrmsMailer.js";

const populateOffboarding = (query) => query.populate("employee", "name email");

const withPendingAssets = async (offboarding) => {
  const pendingAssetReturns = await AssetAssignment.countDocuments({ employee: offboarding.employee._id || offboarding.employee, status: "active" });
  return { ...offboarding.toObject(), pendingAssetReturns };
};

export const initiateOffboarding = async (req, res) => {
  const { employeeId, resignationDate, lastWorkingDate, reason } = req.body;
  if (!employeeId || !resignationDate || !lastWorkingDate) {
    return res.status(400).json({ message: "employeeId, resignationDate and lastWorkingDate are required" });
  }

  const employee = await User.findById(employeeId).select("name email");
  if (!employee) return res.status(404).json({ message: "Employee not found" });

  let offboarding;
  try {
    offboarding = await Offboarding.create({
      employee: employeeId,
      resignationDate,
      lastWorkingDate,
      reason: reason?.trim() || "",
      initiatedBy: req.user._id,
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Offboarding already exists for this employee" });
    throw error;
  }

  writeAuditLog({
    type: "database", event: "hrms.offboarding.initiated", action: "hrms.offboarding.initiated",
    actorId: req.user._id, targetId: offboarding._id, oldValue: null, newValue: { employee: employeeId },
  });
  notifyUsers([employeeId], {
    title: "Offboarding initiated",
    message: "HR has recorded your resignation. Check the HRMS Lifecycle page for your last working date.",
    type: "offboardingInitiated",
    activityType: "create",
    performedBy: req.user._id,
  });
  sendHrmsEmail(
    employee.email, "Your offboarding has been initiated", "Offboarding initiated",
    `<p>Hi ${employee.name}, HR has recorded your resignation with a last working date of <strong>${new Date(lastWorkingDate).toDateString()}</strong>. Check the HRMS Lifecycle page for details.</p>`,
  );

  res.status(201).json(await withPendingAssets(await populateOffboarding(Offboarding.findById(offboarding._id))));
};

export const listOffboarding = async (req, res) => {
  const filter = {};
  if (req.query.status?.trim()) filter.status = req.query.status.trim();
  const records = await populateOffboarding(Offboarding.find(filter)).sort({ createdAt: -1 });
  res.json(await Promise.all(records.map(withPendingAssets)));
};

export const getMyOffboarding = async (req, res) => {
  const record = await populateOffboarding(Offboarding.findOne({ employee: req.user._id }));
  if (!record) return res.status(404).json({ message: "No offboarding record found" });
  res.json(await withPendingAssets(record));
};

export const recordExitInterview = async (req, res) => {
  const offboarding = await Offboarding.findById(req.params.id);
  if (!offboarding) return res.status(404).json({ message: "Offboarding record not found" });

  offboarding.exitInterview = {
    conducted: true,
    conductedBy: req.user._id,
    conductedAt: new Date(),
    notes: req.body.notes?.trim() || "",
  };
  await offboarding.save();

  writeAuditLog({
    type: "database", event: "hrms.offboarding.exitInterviewRecorded", action: "hrms.offboarding.exitInterviewRecorded",
    actorId: req.user._id, targetId: offboarding._id, oldValue: null, newValue: { conducted: true },
  });
  res.json(await withPendingAssets(await populateOffboarding(Offboarding.findById(offboarding._id))));
};

export const processFinalSettlement = async (req, res) => {
  const offboarding = await Offboarding.findById(req.params.id).populate("employee", "name email");
  if (!offboarding) return res.status(404).json({ message: "Offboarding record not found" });
  if (!offboarding.exitInterview.conducted) {
    return res.status(409).json({ message: "Record the exit interview before processing final settlement" });
  }
  const pendingAssetReturns = await AssetAssignment.countDocuments({ employee: offboarding.employee._id, status: "active" });
  if (pendingAssetReturns > 0) {
    return res.status(409).json({ message: `${pendingAssetReturns} asset(s) still need to be returned first` });
  }

  offboarding.finalSettlement = {
    processed: true,
    processedBy: req.user._id,
    processedAt: new Date(),
    notes: req.body.notes?.trim() || "",
  };
  offboarding.status = "cleared";
  await offboarding.save();

  writeAuditLog({
    type: "database", event: "hrms.offboarding.settled", action: "hrms.offboarding.settled",
    actorId: req.user._id, targetId: offboarding._id, oldValue: { status: "notice_period" }, newValue: { status: "cleared" },
  });
  notifyUsers([offboarding.employee._id], {
    title: "Final settlement processed",
    message: "Your final settlement has been processed and your offboarding is complete.",
    type: "offboardingSettled",
    activityType: "status_change",
    performedBy: req.user._id,
  });
  sendHrmsEmail(
    offboarding.employee.email, "Your final settlement has been processed", "Final settlement processed",
    `<p>Hi ${offboarding.employee.name}, your final settlement has been processed and your offboarding is now complete. We wish you the best.</p>`,
  );

  res.json(await withPendingAssets(await populateOffboarding(Offboarding.findById(offboarding._id))));
};
