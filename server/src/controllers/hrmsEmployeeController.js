import User from "../models/User.js";
import ProjectRoleAssignment from "../models/ProjectRoleAssignment.js";
import { writeAuditLog } from "../utils/activityLog.js";

// HR-specific employee-profile fields only — role/manager/archive are edited
// through the existing generic /api/users/:id endpoints (see hrmsRoutes.md /
// userController.js), so this controller doesn't duplicate that logic.
const HR_EDITABLE_FIELDS = ["department", "designation", "joiningDate", "employmentStatus"];

// `limit` is opt-in: existing callers that just want the full roster for a
// <select> (Payroll, Assets, Lifecycle, Documents pickers) keep getting a
// plain array with no params, unchanged. Only the Employees list page passes
// page/limit, in which case the response is sliced and the total count comes
// back via X-Total-Count (keeps the body shape identical either way).
export const listEmployees = async (req, res) => {
  const { search, department, status, page, limit } = req.query;
  const filter = { "archived.account": { $ne: true } };
  if (search?.trim()) {
    filter.$or = [
      { name: { $regex: search.trim(), $options: "i" } },
      { email: { $regex: search.trim(), $options: "i" } },
    ];
  }
  if (department?.trim()) filter.department = department.trim();
  if (status?.trim()) filter.employmentStatus = status.trim();

  let query = User.find(filter).select("-password").populate("managerId", "name email").sort({ name: 1 });

  const pageSize = limit ? Math.min(200, Math.max(1, parseInt(limit, 10) || 0)) : null;
  if (pageSize) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const total = await User.countDocuments(filter);
    query = query.skip((pageNum - 1) * pageSize).limit(pageSize);
    res.setHeader("X-Total-Count", total);
  }

  const employees = await query;
  res.json(employees);
};

export const getEmployeeProfile = async (req, res) => {
  const employee = await User.findById(req.params.id).select("-password").populate("managerId", "name email");
  if (!employee) return res.status(404).json({ message: "Employee not found" });

  const projectRoles = await ProjectRoleAssignment.find({ user: employee._id })
    .populate("project", "name status")
    .sort({ createdAt: -1 });

  res.json({ employee, projectRoles });
};

export const updateEmployeeHrFields = async (req, res) => {
  const employee = await User.findById(req.params.id);
  if (!employee) return res.status(404).json({ message: "Employee not found" });

  const oldValue = {};
  const newValue = {};
  for (const field of HR_EDITABLE_FIELDS) {
    if (req.body[field] === undefined) continue;
    oldValue[field] = employee[field];
    employee[field] = req.body[field];
    newValue[field] = req.body[field];
  }
  await employee.save();

  writeAuditLog({
    type: "database",
    event: "hrms.employee.updated",
    action: "hrms.employee.updated",
    actorId: req.user._id,
    targetId: employee._id,
    oldValue,
    newValue,
  });

  res.json(await User.findById(employee._id).select("-password").populate("managerId", "name email"));
};
