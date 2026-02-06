const mongoose = require("mongoose");

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

// Circuit breaker state for MongoDB
const circuit = {
  state: "CLOSED", // CLOSED = normal, OPEN = reject requests, HALF_OPEN = testing
  failures: 0,
  threshold: 3,
  resetTimeout: 30000,
  lastFailure: null,
};

function canConnect() {
  if (circuit.state === "CLOSED") return true;

  if (circuit.state === "OPEN") {
    if (Date.now() - circuit.lastFailure > circuit.resetTimeout) {
      circuit.state = "HALF_OPEN";
      console.log("MongoDB Circuit: HALF_OPEN (testing connection...)");
      return true;
    }
    return false;
  }

  return true; // HALF_OPEN allows one attempt
}

function onSuccess() {
  if (circuit.state !== "CLOSED") {
    console.log("MongoDB Circuit: CLOSED (connection recovered)");
  }
  circuit.failures = 0;
  circuit.state = "CLOSED";
}

function onFailure(error) {
  circuit.failures++;
  circuit.lastFailure = Date.now();

  // Reset cached promise so next request can retry
  cached.promise = null;
  cached.conn = null;

  if (circuit.failures >= circuit.threshold) {
    circuit.state = "OPEN";
    console.warn(`MongoDB Circuit: OPEN (${circuit.failures} failures)`);
  }

  console.error("MongoDB connection failed:", error.message);
}

const connectDB = async () => {
  // Check circuit breaker
  if (!canConnect()) {
    const error = new Error("MongoDB temporarily unavailable");
    error.status = 503;
    throw error;
  }

  // Return existing connection
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // Clear stale connection
  if (mongoose.connection.readyState === 0) {
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
      })
      .then((mongoose) => {
        console.log("MongoDB Connected");
        onSuccess();
        return mongoose;
      })
      .catch((error) => {
        onFailure(error);
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    // Ensure circuit breaker registers failure
    if (circuit.state !== "OPEN") {
      onFailure(error);
    }
    const serviceError = new Error("MongoDB temporarily unavailable");
    serviceError.status = 503;
    throw serviceError;
  }
};

function isHealthy() {
  return circuit.state === "CLOSED" && mongoose.connection.readyState === 1;
}

function getStatus() {
  return {
    ...circuit,
    readyState: mongoose.connection.readyState,
  };
}

module.exports = connectDB;
module.exports.isHealthy = isHealthy;
module.exports.getStatus = getStatus;
