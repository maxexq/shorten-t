const cron = require("node-cron");
const urlService = require("../services/urlService");

// Sync clicks to MongoDB daily at midnight
cron.schedule("0 0 * * *", async () => {
  try {
    console.log("Syncing clicks to database...");
    await urlService.syncClicksToDatabase();
  } catch (error) {
    console.error("Failed to sync clicks:", error.message);
  }
});

module.exports = cron;
