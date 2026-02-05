const cron = require("node-cron");
const urlService = require("../services/urlService");

// Sync clicks to MongoDB every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  console.log("Syncing clicks to database...");
  await urlService.syncClicksToDatabase();
});

module.exports = cron;
