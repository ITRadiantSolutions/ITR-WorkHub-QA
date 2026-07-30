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
