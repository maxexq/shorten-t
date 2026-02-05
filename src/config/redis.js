const redis = require("redis");

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const redisClient = redis.createClient({ url: redisUrl });

redisClient.on("connect", () => {
  console.log("Connected to Redis");
});

redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});

redisClient.on("ready", () => {
  console.log("Redis is ready");
});

const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
  }
};

connectRedis();

module.exports = redisClient;
