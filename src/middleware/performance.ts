import { Request, Response, NextFunction } from 'express';

/**
 * Performance monitoring middleware
 * Logs request duration and tracks slow requests
 */
export function performanceMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  // Store original end method
  const originalEnd = res.end.bind(res);

  // Override end method to calculate duration
  // Use proper overloads to match Express's res.end signature
  res.end = function (...args: Parameters<typeof originalEnd>) {
    const duration = Date.now() - startTime;
    const durationMs = duration;
    const durationSeconds = (durationMs / 1000).toFixed(2);

    // Log slow requests (> 1 second)
    if (durationMs > 1000) {
      console.warn(
        `⚠️  Slow Request: ${req.method} ${req.path} - ${durationSeconds}s (${durationMs}ms)`,
      );
    }

    // Add performance headers only if headers haven't been sent
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${durationMs}ms`);
      res.setHeader('X-Request-ID', req.headers['x-request-id'] || 'unknown');
    }

    // Call original end method with all arguments
    return originalEnd.apply(res, args);
  } as typeof originalEnd;

  next();
}

/**
 * Database query performance monitoring
 */
export function logSlowQuery(query: string, duration: number) {
  if (duration > 100) {
    // Log queries taking more than 100ms
    console.warn(`⚠️  Slow Query (${duration}ms): ${query.substring(0, 100)}...`);
  }
}
