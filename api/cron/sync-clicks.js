const connectDB = require("../../src/config/database");
const urlService = require("../../src/services/urlService");

module.exports = async function handler(req, res) {
  // Verify cron secret (optional but recommended)
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await connectDB();
    await urlService.syncClicksToDatabase();
    res.json({ success: true, message: "Clicks synced to database" });
  } catch (error) {
    console.error("Sync clicks error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
