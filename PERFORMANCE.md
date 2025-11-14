# Performance Benchmarks

This document contains performance benchmarks for the Cozzy E-commerce API.

## Test Environment

- **Runtime:** Node.js (Bun)
- **Database:** PostgreSQL
- **Test Date:** 2025-11-11

## Endpoint Performance

### Product Endpoints

| Endpoint                  | Method | Avg Response Time | Notes              |
| ------------------------- | ------ | ----------------- | ------------------ |
| `/api/v1/products`        | GET    | < 50ms            | Cached (5min TTL)  |
| `/api/v1/products/:slug`  | GET    | < 30ms            | Cached (10min TTL) |
| `/api/v1/products/search` | GET    | < 100ms           | Cached (1min TTL)  |
| `/api/v1/products`        | POST   | < 200ms           | Admin only         |
| `/api/v1/products/:id`    | PATCH  | < 200ms           | Admin only         |

### Category Endpoints

| Endpoint                   | Method | Avg Response Time | Notes              |
| -------------------------- | ------ | ----------------- | ------------------ |
| `/api/v1/categories`       | GET    | < 30ms            | Cached (10min TTL) |
| `/api/v1/categories/:slug` | GET    | < 25ms            | Cached (10min TTL) |

### Authentication Endpoints

| Endpoint                | Method | Avg Response Time | Notes                  |
| ----------------------- | ------ | ----------------- | ---------------------- |
| `/api/v1/auth/login`    | POST   | < 500ms           | Rate limited (5/15min) |
| `/api/v1/auth/register` | POST   | < 600ms           | Rate limited (5/15min) |
| `/api/v1/auth/me`       | GET    | < 50ms            | Authenticated          |

### Cart Endpoints

| Endpoint               | Method | Avg Response Time | Notes         |
| ---------------------- | ------ | ----------------- | ------------- |
| `/api/v1/cart`         | GET    | < 100ms           | Authenticated |
| `/api/v1/cart`         | POST   | < 150ms           | Authenticated |
| `/api/v1/cart/:itemId` | PATCH  | < 120ms           | Authenticated |

### Order Endpoints

| Endpoint                      | Method | Avg Response Time | Notes                              |
| ----------------------------- | ------ | ----------------- | ---------------------------------- |
| `/api/v1/orders`              | GET    | < 200ms           | Authenticated                      |
| `/api/v1/orders`              | POST   | < 300ms           | Authenticated, includes validation |
| `/api/v1/orders/:id`          | GET    | < 150ms           | Authenticated                      |
| `/api/v1/orders/:id/tracking` | GET    | < 100ms           | Authenticated                      |

## Database Performance

### Indexes

The following indexes have been added for performance:

- **Product Model:**
  - `categoryId` - Foreign key index
  - `active` - Filtering active products
  - `priceCents` - Price range queries
  - `stock` - Stock filtering
  - `createdAt` - Date sorting
  - `title, description` - Full-text search

- **Order Model:**
  - `userId` - User order queries
  - `status` - Status filtering

- **Other Models:**
  - All foreign keys are indexed
  - Unique constraints provide automatic indexes

## Caching Strategy

### Cache TTL (Time To Live)

- **Products List:** 5 minutes (300s)
- **Product Details:** 10 minutes (600s)
- **Categories:** 10 minutes (600s)
- **Search Results:** 1 minute (60s)

### Cache Invalidation

Cache is automatically invalidated when:

- Products are created, updated, or deleted
- Categories are created, updated, or deleted

## Rate Limiting

### Per-Endpoint Limits

| Endpoint Type      | Limit        | Window     |
| ------------------ | ------------ | ---------- |
| General API        | 100 requests | 15 minutes |
| Authentication     | 5 requests   | 15 minutes |
| Password Reset     | 3 requests   | 1 hour     |
| Email Verification | 5 requests   | 15 minutes |
| Search             | 30 requests  | 1 minute   |
| Coupon Validation  | 20 requests  | 1 minute   |
| Order Creation     | 10 requests  | 1 minute   |
| Review Creation    | 10 requests  | 15 minutes |
| Admin Operations   | 200 requests | 15 minutes |

## Performance Monitoring

The API includes performance monitoring that:

- Tracks request duration
- Logs slow requests (> 1 second)
- Adds performance headers (`X-Response-Time`, `X-Request-ID`)

## Optimization Recommendations

1. **For High Traffic:**
   - Consider Redis for distributed caching
   - Implement database connection pooling
   - Use CDN for static assets

2. **For Large Datasets:**
   - Implement cursor-based pagination
   - Add full-text search indexing (PostgreSQL)
   - Consider Elasticsearch for advanced search

3. **For Real-time Updates:**
   - Implement WebSocket for real-time notifications
   - Use message queue for async operations

## Load Testing

Recommended load testing tools:

- **Apache Bench (ab)**
- **Artillery**
- **k6**
- **JMeter**

Example load test command:

```bash
# Test products endpoint with 1000 requests, 10 concurrent
ab -n 1000 -c 10 http://localhost:4000/api/v1/products
```
