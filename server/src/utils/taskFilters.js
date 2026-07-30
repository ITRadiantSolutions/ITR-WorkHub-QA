import Project from "../models/Project.js";

const TASK_STATUSES = new Set(["TODO", "IN_PROGRESS", "ON_HOLD", "QA_TESTING", "DONE"]);

export const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getStatusCondition = (value) => {
  const statuses = String(value || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => TASK_STATUSES.has(s));
  if (!statuses.length) return null;
  return statuses.length === 1 ? statuses[0] : { $in: statuses };
};

export const getCreatedAtRangeMatch = (filterCreated) => {
  if (!filterCreated || filterCreated === "ALL") return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  let from = null;
  if (filterCreated === "TODAY") from = startOfDay(now);
  else if (filterCreated === "LAST_7_DAYS") from = startOfDay(new Date(now).setDate(now.getDate() - 6));
  else if (filterCreated === "LAST_30_DAYS") from = startOfDay(new Date(now).setDate(now.getDate() - 29));
  else if (filterCreated === "THIS_MONTH") from = new Date(now.getFullYear(), now.getMonth(), 1);
  if (!from) return null;

  const to = filterCreated === "THIS_MONTH" ? new Date(now.getFullYear(), now.getMonth() + 1, 0) : now;
  return { $gte: new Date(from), $lte: to };
};

export const buildOverdueMatch = (overdue) => {
  if (overdue !== "true" && overdue !== true) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return { dueDate: { $ne: null, $lt: today }, status: { $ne: "DONE" } };
};

// RBAC scoping: ADMIN sees everything, PM/DEVELOPER/QA/BUSINESS_USER are
// scoped to projects they lead/created/are a team member of, or tasks
// they're directly assigned.
export const buildAccessibleTaskFilter = async (req) => {
  const { status, priority, projectId } = req.query;
  const filter = {};

  const statusCondition = getStatusCondition(status);
  if (statusCondition) filter.status = statusCondition;
  if (priority && priority !== "ALL") filter.priority = priority;

  if (req.user.roles.tracker === "ADMIN") {
    if (projectId) filter.projectId = projectId;
    return filter;
  }

  const userProjects = await Project.find({
    $or: [{ createdBy: req.user._id }, { projectLead: req.user._id }, { teamMembers: req.user._id }],
  }).select("_id");
  const userProjectIds = userProjects.map((p) => p._id);

  if (projectId) {
    if (!userProjectIds.some((id) => id.equals(projectId))) {
      const err = new Error("Access denied: you are not assigned to the requested project.");
      err.status = 403;
      throw err;
    }
    filter.projectId = projectId;
    return filter;
  }

  if (req.user.roles.tracker === "PM") {
    filter.projectId = { $in: userProjectIds };
    return filter;
  }

  filter.$or = [{ assignees: req.user._id }, { projectId: { $in: userProjectIds } }];
  return filter;
};
