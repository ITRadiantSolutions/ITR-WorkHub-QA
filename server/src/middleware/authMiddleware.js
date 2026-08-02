import { verifyToken } from "../utils/jwt.js";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  const user = await User.findById(decoded.id).select("-password");
  if (!user) {
    return res.status(401).json({ message: "User no longer exists" });
  }
  if (user.approvalStatus !== "Approved") {
    return res.status(403).json({ message: "Account is not approved" });
  }
  if (user.archived.account) {
    return res.status(403).json({ message: "Account is deactivated" });
  }

  req.user = user;
  next();
};

// Some routers (timesheet, PMS, tracker) are module-specific, and a user can
// be archived from one module while remaining active elsewhere — `protect`
// only checks the account-wide flag, so routers that live entirely inside
// one module opt into this too, scoped to that module's archived.<module> flag.
export const requireModuleAccess = (module) => (req, res, next) => {
  if (req.user?.archived?.[module]) {
    return res.status(403).json({ message: "Account is deactivated for this module" });
  }
  next();
};
