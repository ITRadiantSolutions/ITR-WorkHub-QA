export function getUser() {
  return JSON.parse(localStorage.getItem("user"));
}

export function getHrmsRole(user) {
  const u = user || getUser();
  return u?.roles?.hrms?.toLowerCase() || "employee";
}

export function isHRMS_Manager(user) {
  return getHrmsRole(user) === "manager";
}

export function isHRMS_HR(user) {
  return getHrmsRole(user) === "hr";
}

export function isHRMS_Employee(user) {
  return getHrmsRole(user) === "employee";
}

export function isSuperAdmin(user) {
  const u = user || getUser();
  return Boolean(u?.isSuperAdmin);
}

// Holding "hr" or "manager" no longer implies edit rights on the Manage
// page by itself — a super admin has to explicitly grant specific modules.
// True if granted ANY module — used to decide whether the "Manage" nav tab
// shows at all. Use canManageModule() for a specific module.
export function hasManageAccess(user) {
  const u = user || getUser();
  return Boolean(u?.isSuperAdmin || u?.manageAccessModules?.length);
}

export function canManageModule(user, moduleKey) {
  const u = user || getUser();
  if (u?.isSuperAdmin) return true;
  return Boolean(u?.manageAccessModules?.includes(moduleKey));
}
