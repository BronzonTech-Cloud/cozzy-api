# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Future changes will be documented here

## [1.1.0] - 2025-11-11

### Added

#### User Features

- Shopping cart management with add, update, remove, and clear operations
- Product reviews and ratings system with verified purchase badges
- Wishlist/favorites functionality
- User profile management with name and email updates
- Address management with multiple addresses and default address support
- Email verification with token-based verification flow
- Password reset functionality via email

#### Order & Product Enhancements

- Order status tracking with history and status updates
- Order cancellation with automatic stock restoration
- Product variants support (size, color, etc.) with custom pricing and stock
- Order history with filtering, pagination, and date range support

#### Discounts & Discovery

- Coupon system with percentage and fixed amount discounts
- Coupon validation with usage limits, expiration, and minimum purchase
- Enhanced product search with filters, sorting, and pagination
- Search suggestions/autocomplete
- Personalized product recommendations based on purchase history
- Related products by category

#### Performance & Optimization

- Response caching for frequently accessed endpoints (products, categories, search)
- Database query optimization with performance indexes
- Per-endpoint rate limiting with appropriate limits
- Performance monitoring with slow request logging
- Cache invalidation on data changes

### Changed

- Enhanced authentication with email verification status
- Improved order creation with coupon code support
- Updated API documentation with new endpoints and schemas
- Rate limiting now includes per-endpoint limits for better security

### Security

- Email verification required for certain actions
- Secure password reset flow with expiring tokens
- Enhanced rate limiting for authentication endpoints
- Token-based email verification and password reset

### Database

- Added `Cart`, `CartItem`, `Review`, `Wishlist`, `Address`, `OrderStatusHistory`, `ProductVariant`, and `Coupon` models
- Added `DiscountType` enum
- Updated `User` model with email verification and password reset fields
- Updated `Order` model with tracking, coupon, and status history fields
- Updated `Product` model with variants relation
- Added performance indexes on Product model

### Testing

- 237 comprehensive tests covering all features
- Test coverage maintained at 80%+
- All tests passing with rate limiting adjustments for test environment

[Unreleased]: https://github.com/BronzonTech-Cloud/cozzy-api/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/BronzonTech-Cloud/cozzy-api/compare/v1.0.0...v1.1.0

## [1.0.0] - 2025-11-07

### Added

- Initial release of Cozzy E-commerce REST API
- JWT authentication with access and refresh tokens
- Role-based access control (Admin and User roles)
- Product management with CRUD operations
- Category management with CRUD operations
- Order management with inventory validation
- Stripe payment integration with webhook support
- Comprehensive test suite with 52+ tests
- Test coverage reporting (78%+ coverage)
- CI/CD pipeline with GitHub Actions
- Rate limiting and security middleware
- Input validation with Zod schemas
- Comprehensive API documentation

### Security

- Password hashing with bcrypt
- JWT token-based authentication
- Rate limiting to prevent brute force attacks
- Input validation to prevent injection attacks
- CORS configuration
- Security headers with Helmet.js

[1.0.0]: https://github.com/BronzonTech-Cloud/cozzy-api/releases/tag/v1.0.0
