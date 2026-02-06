const redis = require("redis");
const { initCacheManager } = require("../utils/cacheManager");

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const redisClient = redis.createClient({ url: redisUrl });

let isConnected = false;

redisClient.on("connect", () => {
  console.log("Connected to Redis");
});

redisClient.on("error", (err) => {
  isConnected = false;
  console.error("Redis error:", err);
});

redisClient.on("ready", () => {
  isConnected = true;
  console.log("Redis is ready");
});

redisClient.on("end", () => {
  isConnected = false;
  console.log("Redis connection closed");
});

const connectRedis = async () => {
  try {
    await redisClient.connect();
    initCacheManager(redisClient);
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
    initCacheManager(redisClient);
  }
};

connectRedis();

module.exports = {
  redisClient,
  isConnected: () => isConnected,
};
