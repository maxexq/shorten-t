const { CacheManager } = require('../../src/utils/cacheManager');

// Mock Url model
jest.mock('../../src/models/Url', () => ({
  updateOne: jest.fn(),
}));
jest.mock('../../src/config', () => ({
  cache: {
    failureThreshold: 3,
    resetTimeout: 1000,
    ttl: 86400,
  },
}));

const Url = require('../../src/models/Url');

describe('CacheManager', () => {
  let cacheManager;
  let mockRedis;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setEx: jest.fn(),
      incr: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    };
    cacheManager = new CacheManager(mockRedis, {
      failureThreshold: 3,
      resetTimeout: 100,
      ttl: 86400,
    });
    jest.clearAllMocks();
  });

  describe('Circuit Breaker', () => {
    it('should start in CLOSED state', () => {
      expect(cacheManager.getState().state).toBe('CLOSED');
      expect(cacheManager.isHealthy()).toBe(true);
    });

    it('should remain CLOSED after failures below threshold', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      await cacheManager.getUrl('test');
      await cacheManager.getUrl('test');

      expect(cacheManager.getState().state).toBe('CLOSED');
      expect(cacheManager.getState().failures).toBe(2);
    });

    it('should transition to OPEN after failures exceed threshold', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      await cacheManager.getUrl('test');
      await cacheManager.getUrl('test');
      await cacheManager.getUrl('test');

      expect(cacheManager.getState().state).toBe('OPEN');
      expect(cacheManager.isHealthy()).toBe(false);
    });

    it('should reset failures on success', async () => {
      mockRedis.get.mockRejectedValueOnce(new Error('Redis error'));
      mockRedis.get.mockResolvedValueOnce('https://example.com');

      await cacheManager.getUrl('test');
      expect(cacheManager.getState().failures).toBe(1);

      await cacheManager.getUrl('test');
      expect(cacheManager.getState().failures).toBe(0);
      expect(cacheManager.getState().state).toBe('CLOSED');
    });

    it('should use fallback when OPEN', async () => {
      // Trigger OPEN state
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      await cacheManager.getUrl('test');
      await cacheManager.getUrl('test');
      await cacheManager.getUrl('test');

      expect(cacheManager.getState().state).toBe('OPEN');

      // Reset mock to track new calls
      mockRedis.get.mockClear();

      // Should not call Redis when OPEN
      const result = await cacheManager.getUrl('test');
      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      // Trigger OPEN state
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      await cacheManager.getUrl('test');
      await cacheManager.getUrl('test');
      await cacheManager.getUrl('test');

      expect(cacheManager.getState().state).toBe('OPEN');

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next call should attempt Redis (HALF_OPEN)
      mockRedis.get.mockResolvedValueOnce('https://example.com');
      await cacheManager.getUrl('test');

      expect(cacheManager.getState().state).toBe('CLOSED');
    });

    it('should return to OPEN if HALF_OPEN test fails', async () => {
      // Trigger OPEN state
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      await cacheManager.getUrl('test');
      await cacheManager.getUrl('test');
      await cacheManager.getUrl('test');

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // HALF_OPEN test fails
      await cacheManager.getUrl('test');

      expect(cacheManager.getState().state).toBe('OPEN');
    });
  });

  describe('getUrl', () => {
    it('should return cached URL from Redis', async () => {
      mockRedis.get.mockResolvedValue('https://example.com');

      const result = await cacheManager.getUrl('abc123');

      expect(mockRedis.get).toHaveBeenCalledWith('link:abc123');
      expect(result).toBe('https://example.com');
    });

    it('should return null on Redis failure', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheManager.getUrl('abc123');

      expect(result).toBeNull();
    });
  });

  describe('setUrl', () => {
    it('should cache URL in Redis', async () => {
      mockRedis.setEx.mockResolvedValue('OK');

      const result = await cacheManager.setUrl('abc123', 'https://example.com');

      expect(mockRedis.setEx).toHaveBeenCalledWith('link:abc123', 86400, 'https://example.com');
      expect(result).toBe(true);
    });

    it('should return false on Redis failure', async () => {
      mockRedis.setEx.mockRejectedValue(new Error('Redis error'));

      const result = await cacheManager.setUrl('abc123', 'https://example.com');

      expect(result).toBe(false);
    });

    it('should use custom TTL when provided', async () => {
      mockRedis.setEx.mockResolvedValue('OK');

      await cacheManager.setUrl('abc123', 'https://example.com', 3600);

      expect(mockRedis.setEx).toHaveBeenCalledWith('link:abc123', 3600, 'https://example.com');
    });
  });

  describe('incrementClicks', () => {
    it('should increment clicks in Redis', async () => {
      mockRedis.incr.mockResolvedValue(1);

      const result = await cacheManager.incrementClicks('abc123');

      expect(mockRedis.incr).toHaveBeenCalledWith('clicks:abc123');
      expect(result).toEqual({ source: 'redis' });
    });

    it('should fallback to MongoDB on Redis failure', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Redis error'));
      Url.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await cacheManager.incrementClicks('abc123');

      expect(Url.updateOne).toHaveBeenCalledWith(
        { shortCode: 'abc123' },
        { $inc: { clicks: 1 } }
      );
      expect(result).toEqual({ source: 'mongodb' });
    });
  });

  describe('getClickKeys', () => {
    it('should return click keys from Redis', async () => {
      mockRedis.keys.mockResolvedValue(['clicks:abc', 'clicks:def']);

      const result = await cacheManager.getClickKeys();

      expect(mockRedis.keys).toHaveBeenCalledWith('clicks:*');
      expect(result).toEqual(['clicks:abc', 'clicks:def']);
    });

    it('should return empty array on Redis failure', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const result = await cacheManager.getClickKeys();

      expect(result).toEqual([]);
    });
  });

  describe('getAndResetClicks', () => {
    it('should get and reset clicks from Redis', async () => {
      mockRedis.get.mockResolvedValue('5');
      mockRedis.set.mockResolvedValue('OK');

      const result = await cacheManager.getAndResetClicks('abc123');

      expect(mockRedis.get).toHaveBeenCalledWith('clicks:abc123');
      expect(mockRedis.set).toHaveBeenCalledWith('clicks:abc123', '0');
      expect(result).toBe(5);
    });

    it('should return 0 if clicks is null', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheManager.getAndResetClicks('abc123');

      expect(result).toBe(0);
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should return 0 on Redis failure', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheManager.getAndResetClicks('abc123');

      expect(result).toBe(0);
    });
  });

  describe('deleteCache', () => {
    it('should delete cache keys from Redis', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await cacheManager.deleteCache('abc123');

      expect(mockRedis.del).toHaveBeenCalledWith('link:abc123');
      expect(mockRedis.del).toHaveBeenCalledWith('clicks:abc123');
      expect(result).toBe(true);
    });

    it('should return false on Redis failure', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      const result = await cacheManager.deleteCache('abc123');

      expect(result).toBe(false);
    });
  });
});
