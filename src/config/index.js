module.exports = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/shorten-t",
  baseUrl: process.env.BASE_URL || "http://localhost:3000",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  cache: {
    failureThreshold: parseInt(process.env.CACHE_FAILURE_THRESHOLD) || 5,
    resetTimeout: parseInt(process.env.CACHE_RESET_TIMEOUT) || 30000,
    ttl: parseInt(process.env.CACHE_TTL) || 86400,
  },
};
