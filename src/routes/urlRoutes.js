const express = require("express");
const urlController = require("../controllers/urlController");
const {
  validateUrl,
  handleValidationErrors,
} = require("../middlewares/validator");

const router = express.Router();

// Create short URL
router.post(
  "/shorten",
  validateUrl,
  handleValidationErrors,
  urlController.createShortUrl,
);

// Get all URLs with pagination
router.get("/urls", urlController.getAllUrls);

// Get URL statistics
router.get("/stats/:shortCode", urlController.getUrlStats);

// Delete a short URL
router.delete("/:shortCode", urlController.deleteUrl);

module.exports = router;
