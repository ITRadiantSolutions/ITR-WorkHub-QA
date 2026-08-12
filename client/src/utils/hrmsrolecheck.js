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
