import User from "../models/User.js";
import { signToken } from "../utils/jwt.js";
import { toPublicUser } from "../utils/publicUser.js";

const isTrustedDomain = (email = "") =>
  Boolean(process.env.TRUSTED_EMAIL_DOMAIN) &&
  email.toLowerCase().endsWith(`@${process.env.TRUSTED_EMAIL_DOMAIN.toLowerCase()}`);

export const register = async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email and password are required" });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: "An account with this email already exists" });
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    authProvider: "local",
    roles: { timesheet: "employee", pms: "employee", tracker: role || "BUSINESS_USER" },
    approvalStatus: isTrustedDomain(email) ? "Approved" : "Pending",
    approvedAt: isTrustedDomain(email) ? new Date() : null,
  });

  if (user.approvalStatus !== "Approved") {
    return res.status(201).json({ message: "Registered. Awaiting approval.", autoApproved: false, status: "Pending", email: user.email });
  }

  const token = signToken(user);
  return res.status(201).json({ token, user: toPublicUser(user), autoApproved: true });
};

// Flow_Tracker's frontend logs in with { name, password }; our own Phase 0
// clients use { email, password } — accept whichever identifier is sent.
export const login = async (req, res) => {
  const { name, email, password } = req.body;
  const identifier = email || name;
  if (!identifier || !password) {
    return res.status(400).json({ message: "name/email and password are required" });
  }

  const user = email
    ? await User.findOne({ email: email.toLowerCase() })
    : await User.findOne({ name });
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Legacy plaintext accounts: comparePassword matched a raw string above.
  // Re-save now so pre('save') hashes it and it's never compared as plaintext again.
  if (user.hasLegacyPlaintextPassword()) {
    user.password = password;
    await user.save();
  }

  // `status` + `email` on the 403 body let the frontend route to its
  // waiting-approval / rejected pages instead of just showing a generic error.
  if (user.approvalStatus !== "Approved") {
    return res.status(403).json({ message: "Account is not approved yet", status: user.approvalStatus, email: user.email });
  }
  if (user.archived.account) {
    return res.status(403).json({ message: "Account is deactivated", status: "Deactivated", email: user.email });
  }

  const token = signToken(user);
  return res.json({ token, user: toPublicUser(user) });
};

export const me = async (req, res) => {
  return res.json({ user: toPublicUser(req.user) });
};
