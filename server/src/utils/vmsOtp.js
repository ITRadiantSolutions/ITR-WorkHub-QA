import crypto from "crypto";

// Ported from the standalone VMS project's utils/otp.js, fixed to use a
// CSPRNG — the original used Math.random(), which isn't suitable for a code
// that gates physical building access.
export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

// Invited visitors are scheduled ahead of time (the OTP is only meant to be
// usable on the chosen visitDate — see InviteVisitorModal), so a flat 5-minute
// window would make every non-same-day invite dead on arrival. When a
// visitDate is given, extend expiry through the end of that day; otherwise
// (Guest walk-ins, or a same-day invite where end-of-day is sooner than the
// 5-minute floor) fall back to the flat window.
export function otpExpiresAt(minutes = 5, visitDate = null) {
  const flat = new Date(Date.now() + minutes * 60 * 1000);
  if (!visitDate) return flat;
  const endOfVisitDay = new Date(visitDate);
  if (Number.isNaN(endOfVisitDay.getTime())) return flat;
  endOfVisitDay.setHours(23, 59, 59, 999);
  return endOfVisitDay > flat ? endOfVisitDay : flat;
}

export function isOtpValid(visitor, code) {
  if (!visitor?.otpCode || !visitor?.otpExpiresAt) return false;
  if ((visitor.otpAttempts || 0) >= 3) return false;
  if (new Date(visitor.otpExpiresAt) < new Date()) return false;
  return visitor.otpCode === String(code || "").trim();
}
