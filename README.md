# 🛍️ Cozzy E-commerce REST API

A production-ready, full-featured RESTful E-commerce API built with TypeScript, Express, PostgreSQL, and Stripe integration. Features JWT authentication, role-based access control, inventory management, and secure payment processing.

## ✨ Features

- 🔐 **JWT Authentication** - Secure token-based authentication with refresh tokens
- 👥 **Role-Based Access Control** - Admin and user roles with protected routes
- 📦 **Product Management** - Full CRUD operations with filtering, pagination, and search
- 🏷️ **Category Management** - Organize products with hierarchical categories
- 🛒 **Order Management** - Create and track orders with inventory validation
- 💳 **Stripe Integration** - Secure payment processing with webhook support
- 📊 **Inventory Management** - Real-time stock tracking and validation
- 🧪 **Comprehensive Testing** - 52+ tests with 78%+ code coverage
- 🚀 **CI/CD Ready** - GitHub Actions workflow included
- 🔒 **Security First** - Rate limiting, input validation, CORS, Helmet.js
- 📝 **Type-Safe** - Full TypeScript with Prisma ORM

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Runtime** | Node.js |
| **Language** | TypeScript |
| **Framework** | Express.js |
| **Database** | PostgreSQL |
| **ORM** | Prisma |
| **Authentication** | JWT + bcrypt |
| **Payments** | Stripe API |
| **Testing** | Vitest + Supertest |
| **Code Quality** | ESLint + Prettier |

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [API Documentation](#-api-documentation)
- [Testing](#-testing)
- [Scripts](#-scripts)
- [Project Structure](#-project-structure)
- [Security](#-security)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (or Bun)
- PostgreSQL 14+
- Stripe account (for payments)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/BronzonTech-Cloud/cozzy-api
cd cozzy-api
```

2. **Install dependencies**

```bash
# Using npm
npm install

# Using yarn
yarn install

# Using pnpm
pnpm install

# Using bun
bun install
```

3. **Set up environment variables**

Create a `.env` file in the root directory:

```env
# Server
PORT=4000
APP_URL=http://localhost:4000
CLIENT_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cozzy
DATABASE_URL_TEST=postgresql://user:password@localhost:5432/cozzy_test

# JWT
JWT_ACCESS_SECRET=your-super-secret-access-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

4. **Initialize the database**

```bash
# Run migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to view data
npm run prisma:studio

# Seed the database with sample data
npm run seed
```

5. **Start the development server**

```bash
npm run dev
```

The API will be available at `http://localhost:4000`

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | `4000` |
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `DATABASE_URL_TEST` | Test database connection string | No | Uses `DATABASE_URL` |
| `JWT_ACCESS_SECRET` | Secret for access tokens | Yes | - |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | Yes | - |
| `JWT_ACCESS_EXPIRES` | Access token expiration | No | `15m` |
| `JWT_REFRESH_EXPIRES` | Refresh token expiration | No | `7d` |
| `STRIPE_SECRET_KEY` | Stripe secret key | Yes | - |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | Yes | - |
| `APP_URL` | Application URL | Yes | - |
| `CLIENT_URL` | Frontend URL for CORS | Yes | - |

**Note:** `DATABASE_URL_TEST` is optional but recommended. If not set, tests will use `DATABASE_URL`. Using a separate test database prevents data conflicts.

## 📚 API Documentation

### Interactive API Documentation (ReDoc)

Once the server is running, you can access the beautiful API documentation at:

**http://localhost:4000/api-docs**

The ReDoc UI provides:
- 📖 Beautiful, modern documentation interface
- 🔍 Complete API reference with search functionality
- 📱 Responsive design (mobile-friendly)
- 🎨 Clean, readable layout with custom styling
- 📝 Request/response examples and schemas
- 🔐 Authentication documentation (Bearer token)
- 📄 Downloadable OpenAPI spec at `/api-docs/swagger.json`

### Base URL

```
http://localhost:4000/api/v1
```

### Authentication

All protected routes require a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Authentication Endpoints

#### Register User

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response (201 Created):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER",
    "createdAt": "2025-11-07T00:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200 OK):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Refresh Token

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Get Current User

```http
GET /api/v1/auth/me
Authorization: Bearer <access_token>
```

**Response (200 OK):**

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "USER",
  "createdAt": "2025-11-07T00:00:00.000Z"
}
```

### Product Endpoints

#### List Products

```http
GET /api/v1/products?page=1&limit=10&q=laptop&category=electronics&minPrice=10000&maxPrice=100000&active=true&sort=price_asc
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |
| `q` | string | Search query |
| `category` | string | Category slug |
| `minPrice` | number | Minimum price in cents |
| `maxPrice` | number | Maximum price in cents |
| `active` | boolean | Filter by active status |
| `sort` | string | Sort order: `price_asc`, `price_desc`, `newest` |

**Response (200 OK):**

```json
{
  "products": [
    {
      "id": "uuid",
      "title": "MacBook Pro",
      "slug": "macbook-pro",
      "description": "Powerful laptop",
      "priceCents": 199900,
      "currency": "USD",
      "sku": "MBP-001",
      "images": ["https://example.com/image.jpg"],
      "active": true,
      "stock": 10,
      "categoryId": "uuid",
      "category": {
        "id": "uuid",
        "name": "Electronics",
        "slug": "electronics"
      },
      "createdAt": "2025-11-07T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

#### Get Product by Slug

```http
GET /api/v1/products/macbook-pro
```

**Response (200 OK):**

```json
{
  "id": "uuid",
  "title": "MacBook Pro",
  "slug": "macbook-pro",
  "description": "Powerful laptop",
  "priceCents": 199900,
  "currency": "USD",
  "sku": "MBP-001",
  "images": ["https://example.com/image.jpg"],
  "active": true,
  "stock": 10,
  "categoryId": "uuid",
  "category": {
    "id": "uuid",
    "name": "Electronics",
    "slug": "electronics"
  },
  "createdAt": "2025-11-07T00:00:00.000Z"
}
```

#### Create Product (Admin Only)

```http
POST /api/v1/products
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "title": "New Product",
  "description": "Product description",
  "priceCents": 9999,
  "currency": "USD",
  "sku": "PROD-001",
  "images": ["https://example.com/image.jpg"],
  "active": true,
  "stock": 100,
  "categoryId": "uuid"
}
```

**Response (201 Created):**

```json
{
  "id": "uuid",
  "title": "New Product",
  "slug": "new-product",
  "description": "Product description",
  "priceCents": 9999,
  "currency": "USD",
  "sku": "PROD-001",
  "images": ["https://example.com/image.jpg"],
  "active": true,
  "stock": 100,
  "categoryId": "uuid",
  "createdAt": "2025-11-07T00:00:00.000Z"
}
```

#### Update Product (Admin Only)

```http
PATCH /api/v1/products/:id
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "title": "Updated Product",
  "priceCents": 8999,
  "stock": 50
}
```

**Response (200 OK):** Updated product object

#### Delete Product (Admin Only)

```http
DELETE /api/v1/products/:id
Authorization: Bearer <admin_access_token>
```

**Response (204 No Content):**

### Category Endpoints

#### List Categories

```http
GET /api/v1/categories
```

**Response (200 OK):**

```json
[
  {
    "id": "uuid",
    "name": "Electronics",
    "slug": "electronics",
    "createdAt": "2025-11-07T00:00:00.000Z"
  }
]
```

#### Get Category by Slug

```http
GET /api/v1/categories/electronics
```

**Response (200 OK):** Category object

#### Create Category (Admin Only)

```http
POST /api/v1/categories
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "name": "New Category"
}
```

**Response (201 Created):** Category object

#### Update Category (Admin Only)

```http
PATCH /api/v1/categories/:id
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "name": "Updated Category"
}
```

**Response (200 OK):** Updated category object

#### Delete Category (Admin Only)

```http
DELETE /api/v1/categories/:id
Authorization: Bearer <admin_access_token>
```

**Response (204 No Content):**

### Order Endpoints

#### Create Order

```http
POST /api/v1/orders
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "items": [
    {
      "productId": "uuid",
      "quantity": 2
    }
  ],
  "currency": "USD"
}
```

**Response (201 Created):**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "status": "PENDING",
  "totalCents": 399800,
  "currency": "USD",
  "items": [
    {
      "id": "uuid",
      "productId": "uuid",
      "quantity": 2,
      "priceCents": 199900,
      "product": {
        "id": "uuid",
        "title": "MacBook Pro",
        "slug": "macbook-pro"
      }
    }
  ],
  "createdAt": "2025-11-07T00:00:00.000Z"
}
```

#### List Orders

```http
GET /api/v1/orders
Authorization: Bearer <access_token>
```

**Response (200 OK):** Array of user's orders

#### List All Orders (Admin Only)

```http
GET /api/v1/orders?all=true
Authorization: Bearer <admin_access_token>
```

**Response (200 OK):** Array of all orders

#### Get Order by ID

```http
GET /api/v1/orders/:id
Authorization: Bearer <access_token>
```

**Response (200 OK):** Order object with items

### Payment Endpoints

#### Create Checkout Session

```http
POST /api/v1/payments/checkout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "orderId": "uuid"
}
```

**Response (200 OK):**

```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

#### Stripe Webhook

```http
POST /api/v1/payments/stripe/webhook
Stripe-Signature: <signature>
Content-Type: application/json

<raw_stripe_event>
```

**Note:** This endpoint is called by Stripe. Configure it in your Stripe dashboard.

### User Endpoints (Admin Only)

#### List Users

```http
GET /api/v1/users
Authorization: Bearer <admin_access_token>
```

**Response (200 OK):** Array of users

#### Get User by ID

```http
GET /api/v1/users/:id
Authorization: Bearer <admin_access_token>
```

**Response (200 OK):** User object

## 🧪 Testing

### Setup Test Database

1. **Create test database:**

```bash
createdb cozzy_test
# Or using psql:
psql -U postgres -c "CREATE DATABASE cozzy_test;"
```

2. **Add `DATABASE_URL_TEST` to `.env`:**

```env
DATABASE_URL_TEST=postgresql://user:password@localhost:5432/cozzy_test
```

3. **Prepare test database:**

```bash
npm run test:db:prepare
```

4. **Seed test database (optional):**

```bash
npm run test:db:seed
```

### Run Tests

```bash
# Run all tests with coverage
npm run test

# Run tests in watch mode
npm run test:watch

# Save test results to file
npm run test:save
```

### Test Coverage

Current coverage thresholds:
- **Statements:** 78.74%
- **Branches:** 66.12%
- **Functions:** 84.21%
- **Lines:** 78.74%

All 52 tests passing ✅

## 📜 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build TypeScript to JavaScript |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run test` | Run tests with coverage |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:save` | Run tests and save results to file |
| `npm run test:db:prepare` | Prepare test database (run migrations) |
| `npm run test:db:seed` | Seed test database |
| `npm run prisma:migrate` | Create and run Prisma migrations |
| `npm run prisma:deploy` | Deploy Prisma migrations |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run seed` | Seed production database |

## 📁 Project Structure

```
cozzy/
├── src/
│   ├── config/          # Configuration files
│   │   ├── env.ts      # Environment variables
│   │   ├── prisma.ts   # Prisma client
│   │   └── stripe.ts   # Stripe client
│   ├── middleware/      # Express middleware
│   │   ├── auth.ts     # Authentication middleware
│   │   ├── error.ts    # Error handling
│   │   └── validate.ts # Request validation
│   ├── modules/        # Feature modules
│   │   ├── auth/       # Authentication
│   │   ├── users/      # User management
│   │   ├── categories/  # Categories
│   │   ├── products/   # Products
│   │   ├── orders/     # Orders
│   │   └── payments/   # Stripe payments
│   ├── routes/         # Route definitions
│   ├── utils/          # Utility functions
│   ├── app.ts          # Express app setup
│   └── server.ts       # Server entry point
├── tests/              # Test files
├── prisma/             # Prisma schema and migrations
├── scripts/            # Utility scripts
├── .github/            # GitHub Actions workflows
└── README.md           # This file
```

## 🔒 Security

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - bcrypt with salt rounds
- **Rate Limiting** - Prevents brute force attacks
- **Input Validation** - Zod schema validation
- **CORS** - Configurable cross-origin resource sharing
- **Helmet.js** - Security headers
- **Environment Variables** - Sensitive data in `.env`
- **SQL Injection Protection** - Prisma ORM parameterized queries

## 🚀 Deployment

### Prerequisites

- PostgreSQL database (managed service recommended)
- Node.js 18+ runtime
- Environment variables configured

### Steps

1. **Build the application:**

```bash
npm run build
```

2. **Run database migrations:**

```bash
npm run prisma:deploy
```

3. **Start the server:**

```bash
npm run start
```

### Environment Variables for Production

Ensure all environment variables are set in your production environment:

- Use strong, randomly generated secrets for JWT
- Use production Stripe keys
- Set proper `APP_URL` and `CLIENT_URL`
- Use a managed PostgreSQL database

### CI/CD

The project includes a GitHub Actions workflow (`.github/workflows/ci.yml`) that:

- Runs on push and pull requests
- Sets up Node.js and PostgreSQL
- Runs linting
- Builds the application
- Runs tests with coverage
- Validates test coverage thresholds

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Maintain test coverage above thresholds
- Follow ESLint and Prettier rules
- Update documentation as needed

## 📝 Notes

- **Prices** are stored in cents (e.g., $19.99 = 1999 cents)
- **Stock** is decremented when an order is created
- **Order status** becomes `PAID` only after Stripe webhook confirmation
- **CORS** is configured for the `CLIENT_URL` environment variable
- **Slugs** are auto-generated from titles using slugify

## 📄 License

This project is licensed under the MIT License.

---

**Built with ❤️ using TypeScript, Express, and PostgreSQL**
