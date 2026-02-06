const Url = require('../../src/models/Url');
const { generateShortCode } = require('../../src/utils/generateCode');

// Mock CacheManager
const mockCacheManager = {
  getUrl: jest.fn(),
  setUrl: jest.fn(),
  incrementClicks: jest.fn(),
  getClickKeys: jest.fn(),
  getAndResetClicks: jest.fn(),
  deleteCache: jest.fn(),
  isHealthy: jest.fn().mockReturnValue(true),
};

// Mock dependencies
jest.mock('../../src/models/Url');
jest.mock('../../src/utils/generateCode');
jest.mock('../../src/config', () => ({
  baseUrl: 'http://localhost:3000',
  cache: {
    failureThreshold: 5,
    resetTimeout: 30000,
    ttl: 86400,
  },
}));
jest.mock('../../src/utils/cacheManager', () => ({
  getCacheManager: () => mockCacheManager,
  initCacheManager: jest.fn(),
}));

// Import service after mocks are set up
const urlService = require('../../src/services/urlService');

describe('UrlService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheManager.isHealthy.mockReturnValue(true);
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
      mockCacheManager.setUrl.mockResolvedValue(true);

      const result = await urlService.createShortUrl('https://example.com');

      expect(generateShortCode).toHaveBeenCalled();
      expect(Url.findOne).toHaveBeenCalledWith({ shortCode: 'abc1234' });
      expect(Url.create).toHaveBeenCalledWith({
        originalUrl: 'https://example.com',
        shortCode: 'abc1234',
        expiresAt: null,
      });
      expect(mockCacheManager.setUrl).toHaveBeenCalledWith('abc1234', 'https://example.com');
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
      mockCacheManager.setUrl.mockResolvedValue(true);

      const result = await urlService.createShortUrl('https://example.com', 'mycode');

      expect(generateShortCode).not.toHaveBeenCalled();
      expect(Url.create).toHaveBeenCalledWith({
        originalUrl: 'https://example.com',
        shortCode: 'mycode',
        expiresAt: null,
      });
      expect(result.shortCode).toBe('mycode');
    });

    it('should throw error if custom code already exists', async () => {
      Url.findOne.mockResolvedValue({ shortCode: 'existing' });

      await expect(
        urlService.createShortUrl('https://example.com', 'existing')
      ).rejects.toEqual({ status: 409, message: 'Short code already exists' });
    });

    it('should create URL with expiration date', async () => {
      const expiresAt = new Date('2026-12-31');
      const mockUrl = {
        _id: 'mock-id',
        originalUrl: 'https://example.com',
        shortCode: 'abc1234',
        createdAt: new Date(),
        expiresAt,
      };

      generateShortCode.mockReturnValue('abc1234');
      Url.findOne.mockResolvedValue(null);
      Url.create.mockResolvedValue(mockUrl);
      mockCacheManager.setUrl.mockResolvedValue(true);

      const result = await urlService.createShortUrl('https://example.com', null, expiresAt);

      expect(Url.create).toHaveBeenCalledWith({
        originalUrl: 'https://example.com',
        shortCode: 'abc1234',
        expiresAt,
      });
      expect(result.expiresAt).toEqual(expiresAt);
    });
  });

  describe('getOriginalUrl', () => {
    it('should return cached URL and increment clicks via CacheManager', async () => {
      mockCacheManager.getUrl.mockResolvedValue('https://example.com');
      mockCacheManager.incrementClicks.mockResolvedValue({ source: 'redis' });

      const result = await urlService.getOriginalUrl('abc1234');

      expect(mockCacheManager.getUrl).toHaveBeenCalledWith('abc1234');
      expect(mockCacheManager.incrementClicks).toHaveBeenCalledWith('abc1234');
      expect(result).toBe('https://example.com');
    });

    it('should fetch from DB and cache when not in cache', async () => {
      const mockUrl = {
        originalUrl: 'https://example.com',
        expiresAt: null,
        incrementClicks: jest.fn().mockResolvedValue({}),
      };

      mockCacheManager.getUrl.mockResolvedValue(null);
      mockCacheManager.setUrl.mockResolvedValue(true);
      Url.findOne.mockResolvedValue(mockUrl);

      const result = await urlService.getOriginalUrl('abc1234');

      expect(Url.findOne).toHaveBeenCalledWith({ shortCode: 'abc1234' });
      expect(mockCacheManager.setUrl).toHaveBeenCalledWith('abc1234', 'https://example.com');
      expect(mockUrl.incrementClicks).toHaveBeenCalled();
      expect(result).toBe('https://example.com');
    });

    it('should throw 404 if URL not found', async () => {
      mockCacheManager.getUrl.mockResolvedValue(null);
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

      mockCacheManager.getUrl.mockResolvedValue(null);
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
    it('should delete URL and clear cache successfully', async () => {
      Url.findOneAndDelete.mockResolvedValue({ shortCode: 'abc1234' });
      mockCacheManager.deleteCache.mockResolvedValue(true);

      const result = await urlService.deleteUrl('abc1234');

      expect(Url.findOneAndDelete).toHaveBeenCalledWith({ shortCode: 'abc1234' });
      expect(mockCacheManager.deleteCache).toHaveBeenCalledWith('abc1234');
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
        {
          _id: 'id1',
          originalUrl: 'https://example1.com',
          shortCode: 'code1',
          clicks: 10,
          createdAt: new Date(),
        },
        {
          _id: 'id2',
          originalUrl: 'https://example2.com',
          shortCode: 'code2',
          clicks: 20,
          createdAt: new Date(),
        },
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockUrls),
      };

      Url.find.mockReturnValue(mockQuery);
      Url.countDocuments.mockResolvedValue(25);

      const result = await urlService.getAllUrls(1, 10);

      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockQuery.skip).toHaveBeenCalledWith(0);
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(result.pagination.totalItems).toBe(25);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.urls).toHaveLength(2);
    });

    it('should handle pagination offset correctly', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      Url.find.mockReturnValue(mockQuery);
      Url.countDocuments.mockResolvedValue(0);

      await urlService.getAllUrls(3, 10);

      expect(mockQuery.skip).toHaveBeenCalledWith(20);
    });
  });

  describe('syncClicksToDatabase', () => {
    it('should sync clicks from cache to MongoDB', async () => {
      mockCacheManager.getClickKeys.mockResolvedValue(['clicks:code1', 'clicks:code2']);
      mockCacheManager.getAndResetClicks
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(10);
      Url.findOneAndUpdate.mockResolvedValue({});

      await urlService.syncClicksToDatabase();

      expect(mockCacheManager.getClickKeys).toHaveBeenCalled();
      expect(Url.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(Url.findOneAndUpdate).toHaveBeenCalledWith(
        { shortCode: 'code1' },
        { $inc: { clicks: 5 } }
      );
    });

    it('should skip keys with zero clicks', async () => {
      mockCacheManager.getClickKeys.mockResolvedValue(['clicks:code1']);
      mockCacheManager.getAndResetClicks.mockResolvedValue(0);

      await urlService.syncClicksToDatabase();

      expect(Url.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should skip sync when circuit breaker is open', async () => {
      mockCacheManager.isHealthy.mockReturnValue(false);

      await urlService.syncClicksToDatabase();

      expect(mockCacheManager.getClickKeys).not.toHaveBeenCalled();
      expect(Url.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });
});
