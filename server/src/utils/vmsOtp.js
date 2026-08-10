import crypto from "crypto";

// Ported from the standalone VMS project's utils/otp.js, fixed to use a
// CSPRNG — the original used Math.random(), which isn't suitable for a code
// that gates physical building access.
export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export function otpExpiresAt(minutes = 5) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export function isOtpValid(visitor, code) {
  if (!visitor?.otpCode || !visitor?.otpExpiresAt) return false;
  if ((visitor.otpAttempts || 0) >= 3) return false;
  if (new Date(visitor.otpExpiresAt) < new Date()) return false;
  return visitor.otpCode === String(code || "").trim();
}
