const urlService = require('../services/urlService');

class UrlController {
  async createShortUrl(req, res, next) {
    try {
      const { url, customCode, expiresAt } = req.body;
      const result = await urlService.createShortUrl(url, customCode, expiresAt);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async redirectToUrl(req, res, next) {
    try {
      const { shortCode } = req.params;
      const originalUrl = await urlService.getOriginalUrl(shortCode);
      res.redirect(301, originalUrl);
    } catch (error) {
      next(error);
    }
  }

  async getUrlStats(req, res, next) {
    try {
      const { shortCode } = req.params;
      const stats = await urlService.getUrlStats(shortCode);
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteUrl(req, res, next) {
    try {
      const { shortCode } = req.params;
      const result = await urlService.deleteUrl(shortCode);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllUrls(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const result = await urlService.getAllUrls(page, limit);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UrlController();
