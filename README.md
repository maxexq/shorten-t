# Shorten-T

A modern, scalable URL shortener API built with Node.js, Express, and MongoDB.

## Features

- Shorten long URLs with auto-generated or custom short codes
- 301 redirect to original URLs
- Click tracking and analytics
- Redis caching for high-performance redirects
- Scheduled click sync from Redis to MongoDB
- URL expiration support
- Paginated URL listing
- Input validation
- Production-ready with Vercel deployment

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose ODM)
- **Cache:** Redis
- **Scheduler:** node-cron
- **Validation:** express-validator
- **ID Generation:** nanoid
- **Deployment:** Vercel

## Project Structure

```
shorten-t/
├── src/
│   ├── config/          # Database, Redis & app configuration
│   │   ├── database.js
│   │   ├── redis.js
│   │   └── index.js
│   ├── controllers/     # Request handlers
│   │   └── urlController.js
│   ├── jobs/            # Scheduled tasks
│   │   └── syncClicks.js
│   ├── middlewares/     # Error handling & validation
│   │   ├── errorHandler.js
│   │   └── validator.js
│   ├── models/          # MongoDB schemas
│   │   └── Url.js
│   ├── routes/          # API route definitions
│   │   ├── index.js
│   │   └── urlRoutes.js
│   ├── services/        # Business logic layer
│   │   └── urlService.js
│   ├── utils/           # Helper functions
│   │   └── generateCode.js
│   ├── app.js           # Express app setup
│   └── server.js        # Entry point
├── .env.example
├── .gitignore
├── package.json
├── vercel.json
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | API info and version |
| `POST` | `/api/shorten` | Create a shortened URL |
| `GET` | `/api/urls` | List all URLs (paginated) |
| `GET` | `/api/stats/:shortCode` | Get URL statistics |
| `DELETE` | `/api/:shortCode` | Delete a shortened URL |
| `GET` | `/:shortCode` | Redirect to original URL |
| `GET` | `/health` | Health check endpoint |

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Redis (local or cloud service like Upstash)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/shorten-t.git
cd shorten-t
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure `.env`:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/shorten-t
BASE_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
```

5. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Usage

### Create Short URL

```bash
curl -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/very-long-url"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "originalUrl": "https://example.com/very-long-url",
    "shortUrl": "http://localhost:3000/abc123",
    "shortCode": "abc123",
    "createdAt": "2026-02-04T12:00:00.000Z",
    "expiresAt": null
  }
}
```

### Create with Custom Code & Expiration

```bash
curl -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "customCode": "mylink",
    "expiresAt": "2026-12-31T23:59:59.000Z"
  }'
```

### Get URL Statistics

```bash
curl http://localhost:3000/api/stats/abc123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "originalUrl": "https://example.com",
    "shortUrl": "http://localhost:3000/abc123",
    "shortCode": "abc123",
    "clicks": 42,
    "createdAt": "2026-02-04T12:00:00.000Z",
    "expiresAt": null
  }
}
```

### List All URLs

```bash
curl "http://localhost:3000/api/urls?page=1&limit=10"
```

**Response:**
```json
{
  "success": true,
  "urls": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 50
  }
}
```

### Delete URL

```bash
curl -X DELETE http://localhost:3000/api/abc123
```

### Redirect

Visit `http://localhost:3000/abc123` in browser to redirect to original URL.

## Deployment

### Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login and deploy:
```bash
vercel login
vercel --prod
```

3. Set environment variables in Vercel Dashboard:
   - `MONGODB_URI` - Your MongoDB connection string
   - `BASE_URL` - Your production URL (e.g., `https://shorten-t.vercel.app`)
   - `REDIS_URL` - Your Redis connection string (e.g., Upstash)
   - `NODE_ENV` - `production`

## Live Demo

**Production URL:** https://shorten-t.vercel.app

## License

MIT
