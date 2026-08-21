import SalaryStructure from "../models/SalaryStructure.js";
import { writeAuditLog } from "../utils/activityLog.js";

const COMPONENT_TYPES = ["earning", "contribution", "deduction"];
const PAYMENT_MODES = ["bank_transfer", "cash", "cheque"];

const validateComponents = (components) => {
  if (!Array.isArray(components) || components.length === 0) return "components must be a non-empty array";
  for (const c of components) {
    if (!c.name?.trim()) return "each component needs a name";
    if (!COMPONENT_TYPES.includes(c.type)) return `each component's type must be one of: ${COMPONENT_TYPES.join(", ")}`;
    if (!Number.isFinite(Number(c.amount)) || Number(c.amount) < 0) return "each component's amount must be a non-negative number";
  }
  return null;
};

export const upsertSalaryStructure = async (req, res) => {
  const { employeeId, components, effectiveFrom, paymentMode, uan, monthlySalary } = req.body;
  if (!employeeId) return res.status(400).json({ message: "employeeId is required" });
  const error = validateComponents(components);
  if (error) return res.status(400).json({ message: error });
  if (paymentMode !== undefined && !PAYMENT_MODES.includes(paymentMode)) {
    return res.status(400).json({ message: `paymentMode must be one of: ${PAYMENT_MODES.join(", ")}` });
  }

  const cleanComponents = components.map((c) => ({ name: c.name.trim(), type: c.type, amount: Number(c.amount) }));

  const structure = await SalaryStructure.findOneAndUpdate(
    { employee: employeeId },
    {
      components: cleanComponents,
      effectiveFrom: effectiveFrom || new Date(),
      updatedBy: req.user._id,
      ...(paymentMode !== undefined ? { paymentMode } : {}),
      ...(uan !== undefined ? { uan: uan.trim() } : {}),
      ...(monthlySalary !== undefined ? { monthlySalary: Number(monthlySalary) || 0 } : {}),
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  writeAuditLog({
    type: "database", event: "hrms.salaryStructure.upserted", action: "hrms.salaryStructure.upserted",
    actorId: req.user._id, targetId: structure._id, oldValue: null, newValue: { employee: employeeId },
  });
  res.json(structure);
};

export const getSalaryStructure = async (req, res) => {
  const { employeeId } = req.params;
  if (req.user.roles.hrms !== "hr" && req.user._id.toString() !== employeeId) {
    return res.status(403).json({ message: "Forbidden" });
  }
  const structure = await SalaryStructure.findOne({ employee: employeeId });
  if (!structure) return res.status(404).json({ message: "No salary structure found for this employee" });
  res.json(structure);
};
