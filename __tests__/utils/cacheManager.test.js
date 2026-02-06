// Mock redis before requiring cacheManager
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setEx: jest.fn(),
  incr: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  isReady: true,
};

jest.mock('../../src/config/redis', () => mockRedis);
jest.mock('../../src/models/Url', () => ({
  updateOne: jest.fn(),
}));

const cache = require('../../src/utils/cacheManager');
const Url = require('../../src/models/Url');

describe('CacheManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.isReady = true;
  });

  describe('getUrl', () => {
    it('should return cached URL from Redis', async () => {
      mockRedis.get.mockResolvedValue('https://example.com');

      const result = await cache.getUrl('abc123');

      expect(mockRedis.get).toHaveBeenCalledWith('link:abc123');
      expect(result).toBe('https://example.com');
    });

    it('should return null for invalid shortCode', async () => {
      const result = await cache.getUrl(null);
      expect(result).toBeNull();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should return null on Redis failure', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await cache.getUrl('abc123');

      expect(result).toBeNull();
    });
  });

  describe('setUrl', () => {
    it('should cache URL in Redis', async () => {
      mockRedis.setEx.mockResolvedValue('OK');

      const result = await cache.setUrl('abc123', 'https://example.com');

      expect(mockRedis.setEx).toHaveBeenCalledWith('link:abc123', 86400, 'https://example.com');
      expect(result).toBe(true);
    });

    it('should return false for invalid params', async () => {
      const result = await cache.setUrl(null, 'https://example.com');
      expect(result).toBe(false);
      expect(mockRedis.setEx).not.toHaveBeenCalled();
    });

    it('should use custom TTL', async () => {
      mockRedis.setEx.mockResolvedValue('OK');

      await cache.setUrl('abc123', 'https://example.com', 3600);

      expect(mockRedis.setEx).toHaveBeenCalledWith('link:abc123', 3600, 'https://example.com');
    });
  });

  describe('incrementClicks', () => {
    it('should increment clicks in Redis', async () => {
      mockRedis.incr.mockResolvedValue(1);

      await cache.incrementClicks('abc123');

      expect(mockRedis.incr).toHaveBeenCalledWith('clicks:abc123');
    });

    it('should fallback to MongoDB on Redis failure', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Redis error'));
      Url.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await cache.incrementClicks('abc123');

      expect(Url.updateOne).toHaveBeenCalledWith(
        { shortCode: 'abc123' },
        { $inc: { clicks: 1 } }
      );
    });
  });

  describe('getClicksKeys', () => {
    it('should return click keys from Redis', async () => {
      mockRedis.keys.mockResolvedValue(['clicks:abc', 'clicks:def']);

      const result = await cache.getClicksKeys();

      expect(mockRedis.keys).toHaveBeenCalledWith('clicks:*');
      expect(result).toEqual(['clicks:abc', 'clicks:def']);
    });

    it('should return empty array on failure', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const result = await cache.getClicksKeys();

      expect(result).toEqual([]);
    });
  });

  describe('getAndResetClicks', () => {
    it('should get and reset clicks', async () => {
      mockRedis.get.mockResolvedValue('5');
      mockRedis.set.mockResolvedValue('OK');

      const result = await cache.getAndResetClicks('abc123');

      expect(mockRedis.get).toHaveBeenCalledWith('clicks:abc123');
      expect(mockRedis.set).toHaveBeenCalledWith('clicks:abc123', '0');
      expect(result).toBe(5);
    });

    it('should return 0 for null clicks', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cache.getAndResetClicks('abc123');

      expect(result).toBe(0);
      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });

  describe('deleteUrl', () => {
    it('should delete cache keys', async () => {
      mockRedis.del.mockResolvedValue(1);

      await cache.deleteUrl('abc123');

      expect(mockRedis.del).toHaveBeenCalledWith('link:abc123');
      expect(mockRedis.del).toHaveBeenCalledWith('clicks:abc123');
    });
  });

  describe('health check', () => {
    it('should return health status', () => {
      expect(typeof cache.isHealthy()).toBe('boolean');
    });

    it('should return circuit status', () => {
      const status = cache.getStatus();
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('failures');
    });
  });
});
