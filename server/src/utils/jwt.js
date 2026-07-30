import jwt from "jsonwebtoken";

export const signToken = (user, { expiresIn } = {}) =>
  jwt.sign(
    { id: user._id.toString(), roles: user.roles },
    process.env.JWT_SECRET,
    { expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || "7d" },
  );

export const verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET);
