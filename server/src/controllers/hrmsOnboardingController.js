import Onboarding from "../models/Onboarding.js";
import { writeAuditLog } from "../utils/activityLog.js";
import { notifyUsers } from "../utils/notify.js";

const populateOnboarding = (query) => query.populate("employee", "name email").populate("items.completedBy", "name");

export const startOnboarding = async (req, res) => {
  const { employeeId } = req.body;
  if (!employeeId) return res.status(400).json({ message: "employeeId is required" });

  let onboarding;
  try {
    onboarding = await Onboarding.create({
      employee: employeeId,
      items: Onboarding.DEFAULT_ITEMS.map((label) => ({ label })),
      startedBy: req.user._id,
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Onboarding already exists for this employee" });
    throw error;
  }

  writeAuditLog({
    type: "database", event: "hrms.onboarding.started", action: "hrms.onboarding.started",
    actorId: req.user._id, targetId: onboarding._id, oldValue: null, newValue: { employee: employeeId },
  });
  notifyUsers([employeeId], {
    title: "Onboarding started",
    message: "Your onboarding checklist has been set up. Check the HRMS Lifecycle page for details.",
    type: "onboardingStarted",
    activityType: "create",
    performedBy: req.user._id,
  });

  res.status(201).json(await populateOnboarding(Onboarding.findById(onboarding._id)));
};

export const listOnboarding = async (req, res) => {
  const filter = {};
  if (req.query.status?.trim()) filter.status = req.query.status.trim();
  const records = await populateOnboarding(Onboarding.find(filter)).sort({ createdAt: -1 });
  res.json(records);
};

export const getMyOnboarding = async (req, res) => {
  const record = await populateOnboarding(Onboarding.findOne({ employee: req.user._id }));
  if (!record) return res.status(404).json({ message: "No onboarding checklist found" });
  res.json(record);
};

export const setOnboardingItem = async (req, res) => {
  const onboarding = await Onboarding.findById(req.params.id);
  if (!onboarding) return res.status(404).json({ message: "Onboarding not found" });

  const item = onboarding.items.id(req.params.itemId);
  if (!item) return res.status(404).json({ message: "Checklist item not found" });

  item.done = Boolean(req.body.done);
  item.completedAt = item.done ? new Date() : null;
  item.completedBy = item.done ? req.user._id : null;

  if (onboarding.items.every((i) => i.done)) {
    onboarding.status = "completed";
    onboarding.completedAt = new Date();
  } else {
    onboarding.status = "in_progress";
    onboarding.completedAt = null;
  }
  await onboarding.save();

  writeAuditLog({
    type: "database", event: "hrms.onboarding.itemToggled", action: "hrms.onboarding.itemToggled",
    actorId: req.user._id, targetId: onboarding._id, oldValue: null, newValue: { item: item.label, done: item.done },
  });
  res.json(await populateOnboarding(Onboarding.findById(onboarding._id)));
};
