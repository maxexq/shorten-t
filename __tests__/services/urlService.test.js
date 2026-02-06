const Url = require('../../src/models/Url');
const { generateShortCode } = require('../../src/utils/generateCode');
const cache = require('../../src/utils/cacheManager');

// Mock dependencies
jest.mock('../../src/models/Url');
jest.mock('../../src/utils/generateCode');
jest.mock('../../src/utils/cacheManager');
jest.mock('../../src/config', () => ({
  baseUrl: 'http://localhost:3000',
}));

const urlService = require('../../src/services/urlService');

describe('UrlService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cache.isHealthy.mockReturnValue(true);
  });

  describe('createShortUrl', () => {
    it('should create a short URL with auto-generated code', async () => {
      const mockUrl = {
        _id: 'mock-id',
        originalUrl: 'https://example.com',
        shortCode: 'abc1234',
        createdAt: new Date(),
        expiresAt: null,
      };

      generateShortCode.mockReturnValue('abc1234');
      Url.findOne.mockResolvedValue(null);
      Url.create.mockResolvedValue(mockUrl);
      cache.setUrl.mockResolvedValue(true);

      const result = await urlService.createShortUrl('https://example.com');

      expect(generateShortCode).toHaveBeenCalled();
      expect(Url.findOne).toHaveBeenCalledWith({ shortCode: 'abc1234' });
      expect(cache.setUrl).toHaveBeenCalledWith('abc1234', 'https://example.com');
      expect(result.shortUrl).toBe('http://localhost:3000/abc1234');
    });

    it('should create a short URL with custom code', async () => {
      const mockUrl = {
        _id: 'mock-id',
        originalUrl: 'https://example.com',
        shortCode: 'mycode',
        createdAt: new Date(),
        expiresAt: null,
      };

      Url.findOne.mockResolvedValue(null);
      Url.create.mockResolvedValue(mockUrl);
      cache.setUrl.mockResolvedValue(true);

      const result = await urlService.createShortUrl('https://example.com', 'mycode');

      expect(generateShortCode).not.toHaveBeenCalled();
      expect(result.shortCode).toBe('mycode');
    });

    it('should throw error if custom code already exists', async () => {
      Url.findOne.mockResolvedValue({ shortCode: 'existing' });

      await expect(
        urlService.createShortUrl('https://example.com', 'existing')
      ).rejects.toEqual({ status: 409, message: 'Short code already exists' });
    });
  });

  describe('getOriginalUrl', () => {
    it('should return cached URL and increment clicks', async () => {
      cache.getUrl.mockResolvedValue('https://example.com');
      cache.incrementClicks.mockResolvedValue();

      const result = await urlService.getOriginalUrl('abc1234');

      expect(cache.getUrl).toHaveBeenCalledWith('abc1234');
      expect(cache.incrementClicks).toHaveBeenCalledWith('abc1234');
      expect(result).toBe('https://example.com');
    });

    it('should fetch from DB and cache when not in cache', async () => {
      const mockUrl = {
        originalUrl: 'https://example.com',
        expiresAt: null,
        incrementClicks: jest.fn().mockResolvedValue({}),
      };

      cache.getUrl.mockResolvedValue(null);
      cache.setUrl.mockResolvedValue(true);
      Url.findOne.mockResolvedValue(mockUrl);

      const result = await urlService.getOriginalUrl('abc1234');

      expect(Url.findOne).toHaveBeenCalledWith({ shortCode: 'abc1234' });
      expect(cache.setUrl).toHaveBeenCalledWith('abc1234', 'https://example.com');
      expect(mockUrl.incrementClicks).toHaveBeenCalled();
      expect(result).toBe('https://example.com');
    });

    it('should throw 404 if URL not found', async () => {
      cache.getUrl.mockResolvedValue(null);
      Url.findOne.mockResolvedValue(null);

      await expect(urlService.getOriginalUrl('notfound')).rejects.toEqual({
        status: 404,
        message: 'URL not found',
      });
    });

    it('should throw 410 if URL has expired', async () => {
      const mockUrl = {
        originalUrl: 'https://example.com',
        expiresAt: new Date('2020-01-01'),
      };

      cache.getUrl.mockResolvedValue(null);
      Url.findOne.mockResolvedValue(mockUrl);

      await expect(urlService.getOriginalUrl('expired')).rejects.toEqual({
        status: 410,
        message: 'URL has expired',
      });
    });
  });

  describe('getUrlStats', () => {
    it('should return URL statistics', async () => {
      const mockUrl = {
        _id: 'mock-id',
        originalUrl: 'https://example.com',
        shortCode: 'abc1234',
        clicks: 42,
        createdAt: new Date(),
        expiresAt: null,
      };

      Url.findOne.mockResolvedValue(mockUrl);

      const result = await urlService.getUrlStats('abc1234');

      expect(result.clicks).toBe(42);
      expect(result.shortUrl).toBe('http://localhost:3000/abc1234');
    });

    it('should throw 404 if URL not found', async () => {
      Url.findOne.mockResolvedValue(null);

      await expect(urlService.getUrlStats('notfound')).rejects.toEqual({
        status: 404,
        message: 'URL not found',
      });
    });
  });

  describe('deleteUrl', () => {
    it('should delete URL and clear cache', async () => {
      Url.findOneAndDelete.mockResolvedValue({ shortCode: 'abc1234' });
      cache.deleteUrl.mockResolvedValue();

      const result = await urlService.deleteUrl('abc1234');

      expect(Url.findOneAndDelete).toHaveBeenCalledWith({ shortCode: 'abc1234' });
      expect(cache.deleteUrl).toHaveBeenCalledWith('abc1234');
      expect(result.message).toBe('URL deleted successfully');
    });

    it('should throw 404 if URL not found', async () => {
      Url.findOneAndDelete.mockResolvedValue(null);

      await expect(urlService.deleteUrl('notfound')).rejects.toEqual({
        status: 404,
        message: 'URL not found',
      });
    });
  });

  describe('getAllUrls', () => {
    it('should return paginated URLs', async () => {
      const mockUrls = [
        { _id: 'id1', originalUrl: 'https://example1.com', shortCode: 'code1', clicks: 10, createdAt: new Date() },
        { _id: 'id2', originalUrl: 'https://example2.com', shortCode: 'code2', clicks: 20, createdAt: new Date() },
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockUrls),
      };

      Url.find.mockReturnValue(mockQuery);
      Url.countDocuments.mockResolvedValue(25);

      const result = await urlService.getAllUrls(1, 10);

      expect(result.pagination.totalItems).toBe(25);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.urls).toHaveLength(2);
    });
  });

  describe('syncClicksToDatabase', () => {
    it('should sync clicks from cache to MongoDB', async () => {
      cache.getClicksKeys.mockResolvedValue(['clicks:code1', 'clicks:code2']);
      cache.getAndResetClicks
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(10);
      Url.findOneAndUpdate.mockResolvedValue({});

      await urlService.syncClicksToDatabase();

      expect(Url.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(Url.findOneAndUpdate).toHaveBeenCalledWith(
        { shortCode: 'code1' },
        { $inc: { clicks: 5 } }
      );
    });

    it('should skip sync when circuit breaker is open', async () => {
      cache.isHealthy.mockReturnValue(false);

      await urlService.syncClicksToDatabase();

      expect(cache.getClicksKeys).not.toHaveBeenCalled();
    });
  });
});
