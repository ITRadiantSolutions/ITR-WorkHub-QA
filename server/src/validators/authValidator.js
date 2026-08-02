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

// Login accepts either { email, password } or Flow_Tracker's legacy
// { name, password } — validate whichever identifier was sent, and don't
// enforce a password minLength here since legacy plaintext accounts may
// have shorter passwords that still need to log in once to get rehashed.
export const validateLogin = [
  body().custom((_, { req }) => {
    if (!req.body.email && !req.body.name) {
      throw new Error("email or name is required");
    }
    return true;
  }),
  body("email").optional().isString().trim().isEmail().withMessage("Email must be a valid email address"),
  body("name").optional().isString().trim().isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
  body("password").isString().withMessage("Password is required").notEmpty().withMessage("Password is required"),
  handleValidation,
];
