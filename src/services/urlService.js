const Url = require("../models/Url");
const { generateShortCode } = require("../utils/generateCode");
const config = require("../config");
const cache = require("../utils/cacheManager");

class UrlService {
  async createShortUrl(originalUrl, customCode = null, expiresAt = null) {
    const shortCode = customCode || generateShortCode();

    const existingUrl = await Url.findOne({ shortCode });
    if (existingUrl) {
      throw { status: 409, message: "Short code already exists" };
    }

    const url = await Url.create({
      originalUrl,
      shortCode,
      expiresAt,
    });

    // Cache the new URL
    await cache.setUrl(shortCode, originalUrl);

    return {
      id: url._id,
      originalUrl: url.originalUrl,
      shortUrl: `${config.baseUrl}/${url.shortCode}`,
      shortCode: url.shortCode,
      createdAt: url.createdAt,
      expiresAt: url.expiresAt,
    };
  }

  async getOriginalUrl(shortCode) {
    // Try cache first
    const cachedUrl = await cache.getUrl(shortCode);

    if (cachedUrl) {
      await cache.incrementClicks(shortCode);
      return cachedUrl;
    }

    // Cache miss - get from database
    const url = await Url.findOne({ shortCode });

    if (!url) {
      throw { status: 404, message: "URL not found" };
    }

    if (url.expiresAt && new Date() > url.expiresAt) {
      throw { status: 410, message: "URL has expired" };
    }

    // Cache for next time
    await cache.setUrl(shortCode, url.originalUrl);

    // Increment clicks in database (first visit)
    await url.incrementClicks();

    return url.originalUrl;
  }

  async syncClicksToDatabase() {
    if (!cache.isHealthy()) {
      console.log("Sync skipped: Redis unavailable");
      return;
    }

    console.log("Syncing clicks to database...");

    const keys = await cache.getClicksKeys();

    for (const key of keys) {
      const shortCode = key.replace("clicks:", "");
      const clicks = await cache.getAndResetClicks(shortCode);

      if (clicks > 0) {
        await Url.findOneAndUpdate({ shortCode }, { $inc: { clicks } });
        console.log(`Synced ${clicks} clicks for ${shortCode}`);
      }
    }

    console.log("Sync complete");
  }

  async getUrlStats(shortCode) {
    const url = await Url.findOne({ shortCode });

    if (!url) {
      throw { status: 404, message: "URL not found" };
    }

    return {
      id: url._id,
      originalUrl: url.originalUrl,
      shortUrl: `${config.baseUrl}/${url.shortCode}`,
      shortCode: url.shortCode,
      clicks: url.clicks,
      createdAt: url.createdAt,
      expiresAt: url.expiresAt,
    };
  }

  async deleteUrl(shortCode) {
    const result = await Url.findOneAndDelete({ shortCode });

    if (!result) {
      throw { status: 404, message: "URL not found" };
    }

    // Clear from cache
    await cache.deleteUrl(shortCode);

    return { message: "URL deleted successfully" };
  }

  async getAllUrls(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [urls, total] = await Promise.all([
      Url.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Url.countDocuments(),
    ]);

    return {
      urls: urls.map((url) => ({
        id: url._id,
        originalUrl: url.originalUrl,
        shortUrl: `${config.baseUrl}/${url.shortCode}`,
        shortCode: url.shortCode,
        clicks: url.clicks,
        createdAt: url.createdAt,
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      },
    };
  }
}

module.exports = new UrlService();
