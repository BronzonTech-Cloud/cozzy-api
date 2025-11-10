# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Future changes will be documented here

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

[Unreleased]: https://github.com/BronzonTech-Cloud/cozzy-api/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/BronzonTech-Cloud/cozzy-api/releases/tag/v1.0.0
