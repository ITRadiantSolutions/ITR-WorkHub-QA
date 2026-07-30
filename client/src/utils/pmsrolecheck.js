export function getUser() {
  return JSON.parse(localStorage.getItem("user"));
}

// Prefer the user object passed in (already in component state) over a fresh
// localStorage read, so PMS role checks don't drift out of sync with what
// the component already has. Our unified user model namespaces this as
// roles.pms rather than a flat pms_role field.
export function getPmsRole(user) {
  const u = user || getUser();
  return u?.roles?.pms?.toLowerCase() || "employee";
}

export function isPMS_Manager(user) {
  return getPmsRole(user) === "manager";
}

export function isPMS_HR(user) {
  return getPmsRole(user) === "hr";
}

export function isPMS_Employee(user) {
  return getPmsRole(user) === "employee";
}
