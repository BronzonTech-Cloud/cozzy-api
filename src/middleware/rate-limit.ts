import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';
import { isIP } from 'net';

import { env } from '../config/env';

/**
 * Create a rate limiter with custom options
 * In test environment, uses much higher limits to avoid test failures
 */
export function createRateLimiter(options: {
  windowMs?: number;
  max?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // 100 requests per window
    message = 'Too many requests from this IP, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator,
  } = options;

  // In test environment, use much higher limits to avoid test failures
  const isTest = env.NODE_ENV === 'test';
  const effectiveMax = isTest ? max * 1000 : max; // 1000x higher in tests

  /**
   * Default key generator with robust IP detection and validation
   *
   * IMPORTANT: X-Forwarded-For and X-Real-IP headers are spoofable and should
   * only be trusted when behind a properly configured reverse proxy/load balancer.
   * Ensure Express trust proxy is configured (app.set('trust proxy', true)) and
   * that your proxy strips or validates these headers from untrusted sources.
   *
   * Uses ipKeyGenerator helper from express-rate-limit for IPv6 compatibility.
   */
  const defaultKeyGenerator = (req: Request): string => {
    // Extract IP address first
    let detectedIp: string | undefined;

    // Try req.ip first (requires trust proxy to be configured)
    // Validate that req.ip is a real IP address
    if (req.ip && isIP(req.ip) !== 0) {
      detectedIp = req.ip;
    }
    // Try X-Forwarded-For header (first IP in the chain)
    // WARNING: This header can be spoofed by clients - only trust behind a proxy
    else if (req.headers['x-forwarded-for']) {
      const forwardedFor = req.headers['x-forwarded-for'];
      const ips = typeof forwardedFor === 'string' ? forwardedFor.split(',') : forwardedFor;
      const firstIp = ips[0]?.trim();
      // Validate that the extracted IP is a real IP address
      if (firstIp && isIP(firstIp) !== 0) {
        detectedIp = firstIp;
      }
    }
    // Try X-Real-IP header
    // WARNING: This header can be spoofed by clients - only trust behind a proxy
    else if (req.headers['x-real-ip']) {
      const realIp = req.headers['x-real-ip'];
      if (typeof realIp === 'string') {
        const trimmedIp = realIp.trim();
        // Validate that the extracted IP is a real IP address
        if (isIP(trimmedIp) !== 0) {
          detectedIp = trimmedIp;
        }
      }
    }
    // Try socket remote address as fallback
    else if (req.socket?.remoteAddress && isIP(req.socket.remoteAddress) !== 0) {
      detectedIp = req.socket.remoteAddress;
    }

    // If we have a valid IP, use ipKeyGenerator helper for proper IPv6 handling
    // This ensures compatibility with express-rate-limit's validation
    if (detectedIp) {
      try {
        return ipKeyGenerator(detectedIp);
      } catch {
        // If ipKeyGenerator fails, return the IP directly
        return detectedIp;
      }
    }

    // If IP detection fails, log for debugging (optional)
    if (env.NODE_ENV === 'development') {
      console.warn('⚠️  Rate limiter: Could not determine valid client IP, using fallback');
    }

    // Final fallback: return a stable identifier to ensure rate limiting still works
    // This prevents undefined from breaking express-rate-limit
    return 'unknown-client';
  };

  return rateLimit({
    windowMs,
    max: effectiveMax,
    message,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    skipSuccessfulRequests,
    skipFailedRequests,
    keyGenerator: keyGenerator || defaultKeyGenerator,
  });
}

/**
 * Rate limiters for different endpoints
 */

// General API rate limiter
export const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'Too many requests, please try again later.',
});

// Strict rate limiter for authentication endpoints
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes (stricter for security)
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Rate limiter for password reset
export const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per hour
  message: 'Too many password reset attempts, please try again later.',
});

// Rate limiter for email verification
export const emailVerificationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  message: 'Too many verification email requests, please try again later.',
});

// Rate limiter for coupon validation
export const couponValidationLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: 'Too many coupon validation requests, please try again later.',
});

// Rate limiter for search endpoints
export const searchLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many search requests, please try again later.',
});

// Rate limiter for admin endpoints
export const adminLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes (higher for admin operations)
  message: 'Too many admin requests, please try again later.',
  keyGenerator: (req: Request): string => {
    // Use user ID for authenticated admin requests, fallback to IP
    if (req.user?.id) {
      return req.user.id;
    }
    // Extract IP address first
    let detectedIp: string | undefined;

    // Try req.ip first (requires trust proxy to be configured)
    if (req.ip && isIP(req.ip) !== 0) {
      detectedIp = req.ip;
    }
    // Try X-Forwarded-For header
    else if (req.headers['x-forwarded-for']) {
      const forwardedFor = req.headers['x-forwarded-for'];
      const ips = typeof forwardedFor === 'string' ? forwardedFor.split(',') : forwardedFor;
      const firstIp = ips[0]?.trim();
      if (firstIp && isIP(firstIp) !== 0) {
        detectedIp = firstIp;
      }
    }
    // Try X-Real-IP header
    else if (req.headers['x-real-ip']) {
      const realIp = req.headers['x-real-ip'];
      if (typeof realIp === 'string') {
        const trimmedIp = realIp.trim();
        if (isIP(trimmedIp) !== 0) {
          detectedIp = trimmedIp;
        }
      }
    }
    // Try socket remote address as fallback
    else if (req.socket?.remoteAddress && isIP(req.socket.remoteAddress) !== 0) {
      detectedIp = req.socket.remoteAddress;
    }

    // If we have a valid IP, use ipKeyGenerator helper for proper IPv6 handling
    if (detectedIp) {
      try {
        return ipKeyGenerator(detectedIp);
      } catch {
        // If ipKeyGenerator fails, return the IP directly
        return detectedIp;
      }
    }

    // Final fallback: return a stable identifier
    return 'unknown-client';
  },
});

// Rate limiter for order creation
export const orderLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 orders per minute
  message: 'Too many order creation requests, please try again later.',
});

// Rate limiter for review creation
export const reviewLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 reviews per 15 minutes
  message: 'Too many review creation requests, please try again later.',
});
