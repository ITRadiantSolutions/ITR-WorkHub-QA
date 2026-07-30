// Shared shape for user objects sent to the client. Includes a flat `role`
// field (mirroring roles.tracker) because Flow_Tracker's unmodified frontend
// reads `user.role` everywhere for dashboards/nav/ProtectedRoute, while
// Timesheet/PMS code reads the namespaced `roles.timesheet`/`roles.pms`.
export function toPublicUser(user) {
  return {
    id: user._id,
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.roles.tracker,
    roles: user.roles,
    managerId: user.managerId,
    shift: user.shift,
    archived: user.archived,
    approvalStatus: user.approvalStatus,
    authProvider: user.authProvider,
  };
}
