if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const app = require("./app");
const config = require("./config");

// For local development
if (process.env.NODE_ENV !== "production") {
  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`Base URL: ${config.baseUrl}`);
  });
}

// Export for Vercel
module.exports = app;
