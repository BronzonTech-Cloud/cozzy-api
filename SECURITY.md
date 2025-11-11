# Security Policy

## Supported Versions

We actively support the following versions of Cozzy E-commerce API:

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please follow these steps:

### 1. **Do NOT** open a public issue

Please do not report security vulnerabilities through public GitHub issues.

### 2. Report privately

Please report security vulnerabilities by emailing the maintainers directly or through a private security advisory.

### 3. Include details

When reporting a vulnerability, please include:

- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if any)

### 4. Response time

We will acknowledge your report within 48 hours and provide a more detailed response within 7 days.

### 5. Disclosure policy

- We will work with you to understand and resolve the issue quickly
- We will credit you for the discovery (if desired)
- We will coordinate the disclosure after the vulnerability is fixed

## Security Best Practices

### For Users

1. **Keep dependencies updated**

   ```bash
   npm audit
   npm audit fix
   ```

2. **Use strong secrets**
   - Generate strong, random secrets for JWT tokens
   - Use environment variables for sensitive data
   - Never commit secrets to version control

3. **Enable HTTPS in production**
   - Always use HTTPS in production
   - Configure proper SSL/TLS certificates

4. **Regular security updates**
   - Keep Node.js and dependencies updated
   - Monitor security advisories
   - Apply security patches promptly
   - Run `bun audit` or `npm audit` regularly

5. **Database security**
   - Use strong database passwords
   - Restrict database access
   - Enable database encryption
   - Enable SSL connections in production
   - Regular backups
   - Store connection strings in environment variables

6. **API security**
   - Use per-endpoint rate limiting
   - Implement proper authentication
   - Enable email verification
   - Validate all inputs with Zod schemas
   - Sanitize outputs
   - Use security headers (Helmet.js)
   - Configure CORS properly

### For Developers

1. **Follow secure coding practices**
   - Validate all inputs
   - Sanitize outputs
   - Use parameterized queries (Prisma handles this)
   - Avoid SQL injection vulnerabilities

2. **Authentication and Authorization**
   - Use strong password hashing (bcrypt with 10 salt rounds)
   - Implement proper JWT token management
   - Use role-based access control (ADMIN, USER)
   - Validate tokens on every request
   - Implement email verification
   - Implement secure password reset flow
   - Use secure random token generation

3. **Dependency management**
   - Regularly update dependencies
   - Review dependency security advisories
   - Use `npm audit` to check for vulnerabilities

4. **Code review**
   - Review all code changes
   - Look for security vulnerabilities
   - Test security features
   - Review authentication and authorization logic
   - Check for sensitive data exposure

5. **Testing**
   - Write security-focused tests
   - Test authentication and authorization
   - Test email verification flow
   - Test password reset flow
   - Test input validation
   - Test rate limiting
   - Test error handling
   - Test SQL injection prevention
   - Test XSS prevention

## Known Security Considerations

### JWT Tokens

- Access tokens expire after 15 minutes (configurable)
- Refresh tokens expire after 7 days (configurable)
- Tokens are signed with strong secrets (minimum 32 characters)
- Tokens should be stored securely on the client (httpOnly cookies recommended)

### Password Security

- Passwords are hashed using bcrypt with salt rounds (10 rounds)
- Passwords are never stored in plain text
- Password validation enforces minimum 8 characters
- Password reset tokens expire after 1 hour
- Secure random token generation for password reset (32 bytes)

### Email Verification

- Token-based email verification
- Verification tokens expire after 24 hours
- Secure random token generation (32 bytes)
- Email verification required for certain actions
- Rate limiting on verification email requests (5 requests/15min)

### API Security

- **Per-endpoint rate limiting** prevents brute force attacks:
  - Authentication endpoints: 5 requests/15 minutes
  - Password reset: 3 requests/hour
  - Email verification: 5 requests/15 minutes
  - General API: 100 requests/15 minutes
  - Search endpoints: 30 requests/minute
  - Order creation: 10 orders/minute
- CORS is configured to restrict origins
- Helmet.js adds security headers with Content Security Policy
- Input validation prevents injection attacks (Zod schemas)
- All inputs validated and sanitized

### Database Security

- Prisma ORM uses parameterized queries
- SQL injection is prevented by ORM
- Database credentials are stored in environment variables
- Connection strings not exposed in code

## Security Checklist

### Pre-Production

- [ ] Change all default secrets
- [ ] Use strong, random JWT secrets (minimum 32 characters)
- [ ] Enable HTTPS in production
- [ ] Configure CORS for specific origins (not `*`)
- [ ] Set up rate limiting in production
- [ ] Review and update all dependencies
- [ ] Run security audit (`npm audit` or `bun audit`)
- [ ] Configure database security
- [ ] Set up monitoring and logging
- [ ] Enable email service for production
- [ ] Configure secure cookie settings (if using cookies)
- [ ] Set up backup and recovery strategy
- [ ] Review error handling (don't expose sensitive info)
- [ ] Test authentication and authorization flows
- [ ] Test email verification flow
- [ ] Test password reset flow
- [ ] Review API endpoints for security vulnerabilities

### Production Configuration

- [ ] Use environment-specific configurations
- [ ] Enable request logging (without sensitive data)
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Configure firewall rules
- [ ] Enable database SSL connections
- [ ] Set up regular security updates
- [ ] Monitor for suspicious activity
- [ ] Implement backup strategy
- [ ] Configure performance monitoring
- [ ] Set up slow request logging

## Security Features (v1.1.0)

### New Security Enhancements

- ✅ **Email Verification**: Token-based email verification with 24-hour expiration
- ✅ **Password Reset**: Secure password reset flow with 1-hour token expiration
- ✅ **Enhanced Rate Limiting**: Per-endpoint rate limiting for better security
- ✅ **Performance Monitoring**: Slow request logging and monitoring
- ✅ **Cache Security**: Secure cache implementation with TTL
- ✅ **Request ID Tracking**: Unique request IDs for better traceability

### Security Testing

All security features are thoroughly tested:

- ✅ 237+ tests covering authentication, authorization, and security features
- ✅ Rate limiting tests
- ✅ Input validation tests
- ✅ Email verification tests
- ✅ Password reset tests
- ✅ SQL injection prevention tests

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Prisma Security](https://www.prisma.io/docs/guides/security)
- [Security Audit Report](./SECURITY_AUDIT.md) - Detailed security audit for v1.1.0

## Contact

For security concerns, please contact the maintainers directly.

---

**Thank you for helping keep Cozzy E-commerce API secure!**
