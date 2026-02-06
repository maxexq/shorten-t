const { rateLimit } = require("express-rate-limit");

const createLinkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    error: "Too many links created, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  createLinkLimiter,
};

// URL="http://localhost:3000/api/shorten"

// for i in {1..25}; do
//   echo "Request #$i"
//   curl -s -o /dev/null -w "%{http_code}\n" -X POST $URL \
//   -H "Content-Type: application/json" \
//   -d '{"url": "https://google.com"}'
//   sleep 0.2
// done
