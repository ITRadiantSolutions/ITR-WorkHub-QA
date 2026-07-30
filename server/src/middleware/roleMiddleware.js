// Usage: allowRoles("tracker", "ADMIN", "PM") checks req.user.roles.tracker
export const allowRoles = (moduleName, ...roles) => (req, res, next) => {
  const userRole = req.user?.roles?.[moduleName];
  if (!userRole || !roles.map((r) => r.toLowerCase()).includes(userRole.toLowerCase())) {
    return res.status(403).json({ message: "Forbidden for this role" });
  }
  next();
};
