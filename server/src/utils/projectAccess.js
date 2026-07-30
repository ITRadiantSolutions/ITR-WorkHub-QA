const toId = (v) => (v ? (v._id || v).toString() : null);

export const isPMOrAdmin = (user) => ["PM", "ADMIN"].includes(user.roles.tracker);

export const canManageProject = (user, project) => {
  if (user.roles.tracker === "ADMIN") return true;
  const userId = user._id.toString();
  const isCreator = toId(project.createdBy) === userId;
  const isLead = toId(project.projectLead) === userId;
  const isTeamMember = (project.teamMembers || []).some((m) => toId(m) === userId);
  return isCreator || isLead || isTeamMember;
};

export const canAccessProjectDirectly = (user, project) => {
  if (user.roles.tracker === "ADMIN") return true;
  return canManageProject(user, project);
};

export const canPMAccessProject = (user, project) => {
  const userId = user._id.toString();
  const isLeadOrCreator = toId(project.createdBy) === userId || toId(project.projectLead) === userId;
  const isTeamMember = (project.teamMembers || []).some((m) => toId(m) === userId);
  return isLeadOrCreator || isTeamMember;
};

export const hasProjectAssignedTasks = async (Task, projectId, userId) =>
  Boolean(await Task.exists({ projectId, assignees: userId }));
