const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const urlController = require("./controllers/urlController");
const errorHandler = require("./middlewares/errorHandler");
const connectDB = require("./config/database");
const swaggerDocument = require("./config/swagger.json");

// Start cron jobs (local only - Vercel uses vercel.json crons)
if (process.env.NODE_ENV !== "production") {
  require("./jobs/syncClicks");
}

const app = express();

// CORS middleware
app.use(cors());

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

// Swagger JSON endpoint
app.get("/swagger.json", (req, res) => {
  res.json(swaggerDocument);
});

// Swagger UI (CDN-based for Vercel compatibility)
app.get("/api-docs", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Shorten-T API Docs</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css">
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js"></script>
      <script>
        SwaggerUIBundle({
          url: '/swagger.json',
          dom_id: '#swagger-ui',
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: 'StandaloneLayout'
        });
      </script>
    </body>
    </html>
  `);
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
