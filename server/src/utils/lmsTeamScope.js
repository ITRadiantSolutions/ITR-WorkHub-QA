import User from "../models/User.js";


export const getManagedEmployeeFilter = (actor) => {
  if (actor.roles.lms === "admin") return { "roles.lms": "employee" };
  if (actor.roles.lms === "manager") return { "roles.lms": "employee", managerId: actor._id };
  return { _id: null };
};

export const getManagedEmployeeIds = async (actor) => {
  const employees = await User.find(getManagedEmployeeFilter(actor)).select("_id").lean();
  return employees.map((employee) => employee._id);
};

export const canManageUser = async (actor, targetUserOrId) => {
  if (actor.roles.lms === "admin") return true;
  if (actor.roles.lms !== "manager") return false;

  const target =
    targetUserOrId && typeof targetUserOrId === "object" && targetUserOrId.roles
      ? targetUserOrId
      : await User.findById(targetUserOrId).select("_id roles managerId");

  if (!target || target.roles?.lms !== "employee") return false;
  return Boolean(target.managerId && String(target.managerId) === String(actor._id));
};

export const assertCanManageUser = async (actor, targetUserOrId) => {
  if (!(await canManageUser(actor, targetUserOrId))) {
    const error = new Error("You can only manage employees in your team");
    error.status = 403;
    throw error;
  }
};

export const getManagerOrAdminRecipientIds = async (employee) => {
  if (employee.managerId) return [employee.managerId];
  const admins = await User.find({ "roles.lms": "admin" }).select("_id").lean();
  return admins.map((admin) => admin._id);
};
