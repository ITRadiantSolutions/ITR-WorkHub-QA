// Shared-secret auth for machine-to-machine endpoints that a device
// connector calls directly and can't authenticate as a logged-in user
// against (e.g. the eSSL/ZKTeco iClock ADMS attendance connector). Express
// lowercases incoming header names, so this matches any casing the caller
// sends (X-Api-Key, x-api-key, ...).
export const requireDeviceApiKey = (req, res, next) => {
  const expected = process.env.HRMS_DEVICE_API_KEY;
  if (!expected) {
    return res.status(503).json({ message: "Attendance device integration is not configured" });
  }
  if (req.headers["x-api-key"] !== expected) {
    return res.status(401).json({ message: "Invalid device API key" });
  }
  next();
};
