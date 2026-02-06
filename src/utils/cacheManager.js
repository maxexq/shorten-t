const Url = require("../models/Url");
const config = require("../config");

class CacheManager {
  constructor(redisClient, options = {}) {
    this.redis = redisClient;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.ttl = options.ttl || 86400;
    this.state = "CLOSED";
    this.failures = 0;
    this.lastFailureTime = null;
  }

  async execute(redisOperation, fallbackOperation) {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = "HALF_OPEN";
        console.log("Circuit breaker HALF_OPEN, testing Redis...");
      } else {
        return fallbackOperation();
      }
    }

    try {
      const result = await redisOperation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      console.error("Redis operation failed, using fallback:", error.message);
      return fallbackOperation();
    }
  }

  onSuccess() {
    if (this.state === "HALF_OPEN") {
      console.log("Circuit breaker CLOSED, Redis recovered");
    }
    this.failures = 0;
    this.state = "CLOSED";
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = "OPEN";
      console.warn(`Circuit breaker OPEN after ${this.failures} failures`);
    }
  }

  async getUrl(shortCode) {
    const cacheKey = `link:${shortCode}`;

    return this.execute(
      async () => {
        const cachedUrl = await this.redis.get(cacheKey);
        return cachedUrl;
      },
      async () => {
        return null;
      },
    );
  }

  async setUrl(shortCode, originalUrl, ttl = null) {
    const cacheKey = `link:${shortCode}`;
    const cacheTtl = ttl || this.ttl;

    return this.execute(
      async () => {
        await this.redis.setEx(cacheKey, cacheTtl, originalUrl);
        return true;
      },
      async () => {
        return false;
      },
    );
  }

  async incrementClicks(shortCode) {
    const clicksKey = `clicks:${shortCode}`;

    return this.execute(
      async () => {
        await this.redis.incr(clicksKey);
        return { source: "redis" };
      },
      async () => {
        await Url.updateOne({ shortCode }, { $inc: { clicks: 1 } });
        return { source: "mongodb" };
      },
    );
  }

  async getClickKeys() {
    return this.execute(
      async () => {
        const keys = await this.redis.keys("clicks:*");
        return keys;
      },
      async () => {
        return [];
      },
    );
  }

  async getAndResetClicks(shortCode) {
    const clicksKey = `clicks:${shortCode}`;

    return this.execute(
      async () => {
        const clicks = await this.redis.get(clicksKey);
        if (clicks && parseInt(clicks) > 0) {
          await this.redis.set(clicksKey, "0");
          return parseInt(clicks);
        }
        return 0;
      },
      async () => {
        return 0;
      },
    );
  }

  async deleteCache(shortCode) {
    const cacheKey = `link:${shortCode}`;
    const clicksKey = `clicks:${shortCode}`;

    return this.execute(
      async () => {
        await this.redis.del(cacheKey);
        await this.redis.del(clicksKey);
        return true;
      },
      async () => {
        return false;
      },
    );
  }

  isHealthy() {
    return this.state === "CLOSED";
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

let cacheManagerInstance = null;

const initCacheManager = (redisClient) => {
  cacheManagerInstance = new CacheManager(redisClient, {
    failureThreshold: config.cache?.failureThreshold || 5,
    resetTimeout: config.cache?.resetTimeout || 30000,
    ttl: config.cache?.ttl || 86400,
  });
  return cacheManagerInstance;
};

const getCacheManager = () => {
  if (!cacheManagerInstance) {
    throw new Error("CacheManager not initialized. Call initCacheManager first.");
  }
  return cacheManagerInstance;
};

module.exports = {
  CacheManager,
  initCacheManager,
  getCacheManager,
};
