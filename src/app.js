const express = require('express');
const routes = require('./routes');
const urlController = require('./controllers/urlController');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use(routes);

// Redirect route (must be after API routes)
app.get('/:shortCode', urlController.redirectToUrl);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { status: 404, message: 'Route not found' },
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
