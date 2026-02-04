const Url = require('../models/Url');
const { generateShortCode } = require('../utils/generateCode');
const config = require('../config');

class UrlService {
  async createShortUrl(originalUrl, customCode = null, expiresAt = null) {
    const shortCode = customCode || generateShortCode();

    const existingUrl = await Url.findOne({ shortCode });
    if (existingUrl) {
      throw { status: 409, message: 'Short code already exists' };
    }

    const url = await Url.create({
      originalUrl,
      shortCode,
      expiresAt,
    });

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
    const url = await Url.findOne({ shortCode });

    if (!url) {
      throw { status: 404, message: 'URL not found' };
    }

    if (url.expiresAt && new Date() > url.expiresAt) {
      throw { status: 410, message: 'URL has expired' };
    }

    await url.incrementClicks();
    return url.originalUrl;
  }

  async getUrlStats(shortCode) {
    const url = await Url.findOne({ shortCode });

    if (!url) {
      throw { status: 404, message: 'URL not found' };
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
      throw { status: 404, message: 'URL not found' };
    }

    return { message: 'URL deleted successfully' };
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
