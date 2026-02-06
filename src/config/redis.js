const redis = require("redis");

// Force localhost in development, use env var in production
const redisUrl =
  process.env.NODE_ENV === "production"
    ? process.env.REDIS_URL
    : "redis://localhost:6379";

console.log("Redis connecting to:", redisUrl);
const redisClient = redis.createClient({ url: redisUrl });

redisClient.on("connect", () => console.log("Redis: connecting..."));
redisClient.on("ready", () => console.log("Redis: ready"));
redisClient.on("error", (err) => console.error("Redis error:", err.message));
redisClient.on("end", () => console.log("Redis: disconnected"));

// Connect immediately
redisClient.connect().catch((err) => {
  console.error("Redis connection failed:", err.message);
});

module.exports = redisClient;
