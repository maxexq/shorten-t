const redis = require("../config/redis");
const Url = require("../models/Url");

// Circuit breaker state
const circuit = {
  state: "CLOSED", // CLOSED = normal, OPEN = skip redis, HALF_OPEN = testing
  failures: 0,
  threshold: 5,
  resetTimeout: 30000,
  lastFailure: null,
};

// Check if circuit should allow Redis operations
function canUseRedis() {
  if (circuit.state === "CLOSED") return true;

  if (circuit.state === "OPEN") {
    // Check if enough time passed to retry
    if (Date.now() - circuit.lastFailure > circuit.resetTimeout) {
      circuit.state = "HALF_OPEN";
      console.log("Circuit: HALF_OPEN (testing Redis...)");
      return true;
    }
    return false;
  }

  return true; // HALF_OPEN allows one attempt
}

// Record success
function onSuccess() {
  if (circuit.state !== "CLOSED") {
    console.log("Circuit: CLOSED (Redis recovered)");
  }
  circuit.failures = 0;
  circuit.state = "CLOSED";
}

// Record failure
function onFailure(reason) {
  circuit.failures++;
  circuit.lastFailure = Date.now();

  if (circuit.failures >= circuit.threshold) {
    circuit.state = "OPEN";
    console.warn(`Circuit: OPEN (${circuit.failures} failures)`);
  }

  console.error("Redis failed:", reason);
}

// Helper: execute Redis operation with fallback
async function tryRedis(operation, fallback) {
  // Circuit is OPEN - skip Redis entirely
  if (!canUseRedis()) {
    return fallback();
  }

  // Redis client not connected
  if (!redis.isReady) {
    onFailure("Redis not ready");
    return fallback();
  }

  try {
    const result = await operation();
    onSuccess();
    return result;
  } catch (error) {
    onFailure(error.message);
    return fallback();
  }
}

// ============ Cache Operations ============

async function getUrl(shortCode) {
  if (!shortCode) return null;

  return tryRedis(
    async () => {
      const url = await redis.get(`link:${shortCode}`);
      console.log(`Cache GET: link:${shortCode} = ${url ? "HIT" : "MISS"}`);
      return url;
    },
    () => null,
  );
}

async function setUrl(shortCode, originalUrl, ttl = 86400) {
  if (!shortCode || !originalUrl) return false;

  return tryRedis(
    async () => {
      await redis.setEx(`link:${shortCode}`, ttl, originalUrl);
      console.log(`Cache SET: link:${shortCode}`);
      return true;
    },
    () => {
      console.log(`Cache SET failed: link:${shortCode}`);
      return false;
    },
  );
}

async function incrementClicks(shortCode) {
  if (!shortCode) return;

  return tryRedis(
    () => redis.incr(`clicks:${shortCode}`),
    () => Url.updateOne({ shortCode }, { $inc: { clicks: 1 } }),
  );
}

async function getClicksKeys() {
  return tryRedis(
    () => redis.keys("clicks:*"),
    () => [],
  );
}

async function getAndResetClicks(shortCode) {
  if (!shortCode) return 0;

  return tryRedis(
    async () => {
      const clicks = await redis.get(`clicks:${shortCode}`);
      const count = parseInt(clicks) || 0;
      if (count > 0) {
        await redis.set(`clicks:${shortCode}`, "0");
      }
      return count;
    },
    () => 0,
  );
}

async function deleteUrl(shortCode) {
  if (!shortCode) return;

  return tryRedis(
    async () => {
      await redis.del(`link:${shortCode}`);
      await redis.del(`clicks:${shortCode}`);
    },
    () => {},
  );
}

function isHealthy() {
  return circuit.state === "CLOSED" && redis.isReady;
}

function getStatus() {
  return { ...circuit };
}

module.exports = {
  getUrl,
  setUrl,
  incrementClicks,
  getClicksKeys,
  getAndResetClicks,
  deleteUrl,
  isHealthy,
  getStatus,
};
