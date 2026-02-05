const express = require("express");
const routes = require("./routes");
const urlController = require("./controllers/urlController");
const errorHandler = require("./middlewares/errorHandler");
const connectDB = require("./config/database");

// Start cron jobs (local only - Vercel uses vercel.json crons)
if (process.env.NODE_ENV !== "production") {
  require("./jobs/syncClicks");
}

const app = express();

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure DB connection for each request (serverless)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

app.get("/", (req, res) => {
  res.json({ message: "Welcome to the URL Shortener API!", version: "1.0.0" });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use(routes);

// Redirect route (must be after API routes)
app.get("/:shortCode", urlController.redirectToUrl);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { status: 404, message: "Route not found" },
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
