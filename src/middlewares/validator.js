const { body, validationResult } = require("express-validator");

const validateUrl = [
  body("url")
    .trim()
    .notEmpty()
    .withMessage("URL is required")
    .isURL({ require_protocol: true })
    .withMessage("Please provide a valid URL with protocol (http/https)"),
  body("customCode")
    .optional()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage("Custom code must be between 3 and 20 characters")
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage(
      "Custom code can only contain letters, numbers, hyphens, and underscores",
    ),
  body("expiresAt")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format")
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error("Expiration date must be in the future");
      }
      return true;
    }),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

module.exports = { validateUrl, handleValidationErrors };
