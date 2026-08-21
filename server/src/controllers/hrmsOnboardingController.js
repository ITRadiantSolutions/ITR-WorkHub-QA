import Onboarding from "../models/Onboarding.js";
import User from "../models/User.js";
import { writeAuditLog } from "../utils/activityLog.js";
import { notifyUsers } from "../utils/notify.js";
import { sendHrmsEmail } from "../utils/hrmsMailer.js";

const populateOnboarding = (query) => query.populate("employee", "name email").populate("items.completedBy", "name");

export const startOnboarding = async (req, res) => {
  const { employeeId } = req.body;
  if (!employeeId) return res.status(400).json({ message: "employeeId is required" });

  const employee = await User.findById(employeeId).select("name email");
  if (!employee) return res.status(404).json({ message: "Employee not found" });

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
  sendHrmsEmail(
    employee.email, "Welcome — your onboarding checklist is ready", "Onboarding started",
    `<p>Hi ${employee.name}, welcome aboard! Your onboarding checklist has been set up — check the HRMS Lifecycle page for details.</p>`,
  );

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
  const onboarding = await Onboarding.findById(req.params.id).populate("employee", "name email");
  if (!onboarding) return res.status(404).json({ message: "Onboarding not found" });

  const item = onboarding.items.id(req.params.itemId);
  if (!item) return res.status(404).json({ message: "Checklist item not found" });

  item.done = Boolean(req.body.done);
  item.completedAt = item.done ? new Date() : null;
  item.completedBy = item.done ? req.user._id : null;

  const wasCompleted = onboarding.status === "completed";
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

  if (!wasCompleted && onboarding.status === "completed") {
    notifyUsers([onboarding.employee._id], {
      title: "Onboarding complete",
      message: "Your onboarding checklist is fully complete.",
      type: "onboardingCompleted",
      activityType: "status_change",
      performedBy: req.user._id,
    });
    sendHrmsEmail(
      onboarding.employee.email, "Your onboarding checklist is complete", "Onboarding complete",
      `<p>Hi ${onboarding.employee.name}, your onboarding checklist is now fully complete.</p>`,
    );
  }

  res.json(await populateOnboarding(Onboarding.findById(onboarding._id)));
};
