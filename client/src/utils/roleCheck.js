// Used only within the PMS module in the original app, so this reflects the
// PMS role (roles.pms) — same semantics as utils/pmsrolecheck.js, kept as a
// separate file since PMS components import both names.
export function getUser() {
  return JSON.parse(localStorage.getItem("user"));
}

export function getUserRole() {
  const user = getUser();
  return user?.roles?.pms?.toLowerCase() || "employee";
}

export function isManager() {
  return getUserRole() === "manager";
}

export function isHR() {
  return getUserRole() === "hr";
}

export function isEmployee() {
  return getUserRole() === "employee";
}
