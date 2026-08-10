import { body, validationResult } from "express-validator";

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Validation failed",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  return next();
};

export const validateCreateVisitor = [
  body("fullName").isString().trim().isLength({ min: 2, max: 120 }).withMessage("Full name must be 2-120 characters"),
  body("mobileNumber")
    .isString()
    .trim()
    .customSanitizer((v) => v.replace(/\D/g, ""))
    // Must match what sms.js's formatPhoneNumber can actually dispatch to —
    // a 10-digit Indian number, or one already in +91 form — otherwise the
    // visitor gets created but the OTP SMS fails right after.
    .custom((v) => v.length === 10 || (v.length === 12 && v.startsWith("91")))
    .withMessage("Mobile number must be a valid 10-digit Indian mobile number"),
  body("email").optional({ checkFalsy: true }).isString().trim().isEmail().withMessage("Email must be a valid email address"),
  body("address").optional({ checkFalsy: true }).isString().trim().isLength({ max: 500 }).withMessage("Address must be under 500 characters"),
  body("purpose").optional({ checkFalsy: true }).isString().trim().isLength({ max: 300 }).withMessage("Purpose must be under 300 characters"),
  body("notes").optional({ checkFalsy: true }).isString().trim().isLength({ max: 1000 }).withMessage("Notes must be under 1000 characters"),
  body("expectedDuration").optional({ checkFalsy: true }).isString().trim().isLength({ max: 50 }).withMessage("Duration must be under 50 characters"),
  body("visitorType").optional({ checkFalsy: true }).isIn(["Guest", "Invited"]).withMessage("visitorType must be Guest or Invited"),
  body("visitDate").optional({ checkFalsy: true }).isISO8601().withMessage("visitDate must be a valid date"),
  body("personToMeetId").optional({ checkFalsy: true }).isString().trim().isLength({ max: 200 }),
  handleValidation,
];

export const validateVerifyOtp = [
  body("visitorId").isString().trim().isLength({ min: 24, max: 24 }).matches(/^[0-9a-fA-F]{24}$/).withMessage("visitorId must be a valid id"),
  body("code").isString().trim().isLength({ min: 6, max: 6 }).isNumeric().withMessage("code must be a 6-digit OTP"),
  handleValidation,
];

export const validateResendOtp = [
  body("visitorId").isString().trim().isLength({ min: 24, max: 24 }).matches(/^[0-9a-fA-F]{24}$/).withMessage("visitorId must be a valid id"),
  handleValidation,
];

export const validateVerifyInvitedOtpByCode = [
  body("code").isString().trim().isLength({ min: 6, max: 6 }).isNumeric().withMessage("code must be a 6-digit OTP"),
  handleValidation,
];
