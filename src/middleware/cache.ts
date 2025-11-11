import { Request, Response, NextFunction } from 'express';

import { cache, generateCacheKey } from '../utils/cache';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string; // Cache key prefix
  includeQuery?: boolean; // Include query params in cache key
  includeUser?: boolean; // Include user ID in cache key (for authenticated routes)
}

// Track in-flight requests to prevent cache stampede
const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Cache middleware for Express routes
 */
export function cacheMiddleware(options: CacheOptions = {}) {
  const { ttl = 300, keyPrefix = 'api', includeQuery = true, includeUser = false } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Build cache key
    const params: Record<string, unknown> = {
      path: req.path,
    };

    if (includeQuery && Object.keys(req.query).length > 0) {
      params.query = req.query;
    }

    if (includeUser && req.user?.id) {
      params.userId = req.user.id;
    }

    const cacheKey = generateCacheKey(keyPrefix, params);

    // Try to get from cache
    const cached = cache.get<{ body: unknown; contentType?: string; isBuffer?: boolean }>(cacheKey);
    if (cached) {
      // Restore content-type if it was saved
      if (cached.contentType && !res.headersSent) {
        res.setHeader('Content-Type', cached.contentType);
      }
      // Handle different response types
      if (cached.isBuffer && Buffer.isBuffer(cached.body)) {
        return res.send(cached.body);
      } else if (typeof cached.body === 'string') {
        return res.send(cached.body);
      } else {
        return res.json(cached.body);
      }
    }

    // Check if there's an in-flight request for this cache key (with race condition protection)
    let inFlightPromise = inFlightRequests.get(cacheKey);
    if (inFlightPromise) {
      try {
        const body = await inFlightPromise;
        // Restore content-type if it was saved
        if (typeof body === 'object' && body !== null && 'contentType' in body) {
          const cachedBody = body as { body: unknown; contentType?: string; isBuffer?: boolean };
          if (cachedBody.contentType && !res.headersSent) {
            res.setHeader('Content-Type', cachedBody.contentType);
          }
          if (cachedBody.isBuffer && Buffer.isBuffer(cachedBody.body)) {
            return res.send(cachedBody.body);
          } else if (typeof cachedBody.body === 'string') {
            return res.send(cachedBody.body);
          } else {
            return res.json(cachedBody.body);
          }
        }
        return res.json(body);
      } catch {
        // If the in-flight request failed, retry by checking again
        inFlightPromise = inFlightRequests.get(cacheKey);
        if (inFlightPromise) {
          try {
            const body = await inFlightPromise;
            if (typeof body === 'object' && body !== null && 'contentType' in body) {
              const cachedBody = body as {
                body: unknown;
                contentType?: string;
                isBuffer?: boolean;
              };
              if (cachedBody.contentType && !res.headersSent) {
                res.setHeader('Content-Type', cachedBody.contentType);
              }
              if (cachedBody.isBuffer && Buffer.isBuffer(cachedBody.body)) {
                return res.send(cachedBody.body);
              } else if (typeof cachedBody.body === 'string') {
                return res.send(cachedBody.body);
              } else {
                return res.json(cachedBody.body);
              }
            }
            return res.json(body);
          } catch {
            inFlightRequests.delete(cacheKey);
          }
        }
      }
    }

    // Double-check after async operations (race condition protection)
    inFlightPromise = inFlightRequests.get(cacheKey);
    if (inFlightPromise) {
      try {
        const body = await inFlightPromise;
        if (typeof body === 'object' && body !== null && 'contentType' in body) {
          const cachedBody = body as { body: unknown; contentType?: string; isBuffer?: boolean };
          if (cachedBody.contentType && !res.headersSent) {
            res.setHeader('Content-Type', cachedBody.contentType);
          }
          if (cachedBody.isBuffer && Buffer.isBuffer(cachedBody.body)) {
            return res.send(cachedBody.body);
          } else if (typeof cachedBody.body === 'string') {
            return res.send(cachedBody.body);
          } else {
            return res.json(cachedBody.body);
          }
        }
        return res.json(body);
      } catch {
        inFlightRequests.delete(cacheKey);
      }
    }

    // Create a promise to track this request
    let resolvePromise!: (value: unknown) => void;
    let rejectPromise!: (error: Error) => void;
    const requestPromise = new Promise<unknown>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    // Only set if not already present (another request might have set it)
    if (!inFlightRequests.has(cacheKey)) {
      inFlightRequests.set(cacheKey, requestPromise);
    } else {
      // Another request beat us to it, wait for it instead
      inFlightPromise = inFlightRequests.get(cacheKey)!;
      try {
        const body = await inFlightPromise;
        if (typeof body === 'object' && body !== null && 'contentType' in body) {
          const cachedBody = body as { body: unknown; contentType?: string; isBuffer?: boolean };
          if (cachedBody.contentType && !res.headersSent) {
            res.setHeader('Content-Type', cachedBody.contentType);
          }
          if (cachedBody.isBuffer && Buffer.isBuffer(cachedBody.body)) {
            return res.send(cachedBody.body);
          } else if (typeof cachedBody.body === 'string') {
            return res.send(cachedBody.body);
          } else {
            return res.json(cachedBody.body);
          }
        }
        return res.json(body);
      } catch {
        inFlightRequests.delete(cacheKey);
      }
    }

    // Store original response methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const originalSendFile = res.sendFile.bind(res);
    const originalRender = res.render.bind(res);

    // Track if response has been sent
    let responseSent = false;
    let timeoutId: NodeJS.Timeout | null = null;

    // Helper to handle errors (defined before timeoutId to avoid reference error)
    const handleError = (error: Error) => {
      if (responseSent) return;
      responseSent = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      rejectPromise(error);
      inFlightRequests.delete(cacheKey);
    };

    // Helper to cache and resolve the promise
    const cacheAndResolve = (body: unknown, contentType?: string, isBuffer = false) => {
      if (responseSent) return;
      responseSent = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Only cache successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Store response metadata (content-type and body type)
        const cacheData = {
          body,
          contentType,
          isBuffer,
        };
        cache.set(cacheKey, cacheData, ttl);
        resolvePromise(cacheData);
      } else {
        resolvePromise(body);
      }
      inFlightRequests.delete(cacheKey);
    };

    // Timeout for request (30 seconds)
    timeoutId = setTimeout(() => {
      handleError(new Error('Request timeout'));
    }, 30000);

    // Override json method to cache response
    res.json = function (body: unknown) {
      const contentType = (res.getHeader('content-type') as string) || 'application/json';
      cacheAndResolve(body, contentType, false);
      return originalJson(body);
    };

    // Override send method to cache response (preserve content-type)
    res.send = function (body?: unknown) {
      // Capture content-type before sending
      const contentType = (res.getHeader('content-type') as string) || 'text/html';
      const isBuffer = Buffer.isBuffer(body);

      // Cache the response with metadata
      cacheAndResolve(body, contentType, isBuffer);
      return originalSend(body);
    };

    // Override sendFile method - skip caching for file responses
    // Files are typically large and dynamic, caching them is not recommended
    res.sendFile = function (
      path: string,
      optionsOrCallback?: unknown,
      callback?: (err: Error | null) => void,
    ) {
      // Skip caching for file responses
      // Just clean up the in-flight request
      if (!responseSent) {
        responseSent = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        // Resolve with a marker that this shouldn't be cached
        resolvePromise({ skipCache: true });
        inFlightRequests.delete(cacheKey);
      }

      // Handle different call signatures: sendFile(path), sendFile(path, callback), sendFile(path, options, callback)
      if (callback) {
        // sendFile(path, options, callback)
        return originalSendFile(path, optionsOrCallback as Record<string, unknown>, callback);
      } else if (optionsOrCallback && typeof optionsOrCallback === 'function') {
        // sendFile(path, callback)
        return originalSendFile(path, optionsOrCallback as (err: Error | null) => void);
      } else if (optionsOrCallback) {
        // sendFile(path, options)
        return originalSendFile(path, optionsOrCallback as Record<string, unknown>);
      } else {
        // sendFile(path)
        return originalSendFile(path);
      }
    } as typeof originalSendFile;

    // Override render method to cache response
    res.render = function (
      view: string,
      optionsOrCallback?: unknown,
      callback?: (err: Error, html: string) => void,
    ) {
      // Note: render sends HTML, so we cache the view name and data
      const contentType = (res.getHeader('content-type') as string) || 'text/html';
      cacheAndResolve({ type: 'render', view, data: optionsOrCallback }, contentType, false);
      // Handle different call signatures: render(view), render(view, callback), render(view, options, callback)
      if (callback) {
        // render(view, options, callback)
        return originalRender(view, optionsOrCallback as Record<string, unknown>, callback);
      } else if (optionsOrCallback && typeof optionsOrCallback === 'function') {
        // render(view, callback)
        return originalRender(view, optionsOrCallback as (err: Error, html: string) => void);
      } else if (optionsOrCallback) {
        // render(view, options)
        return originalRender(view, optionsOrCallback as Record<string, unknown>);
      } else {
        // render(view)
        return originalRender(view);
      }
    };

    // Handle errors in the response
    res.on('error', (error: Error) => {
      handleError(error);
    });

    // Handle connection close
    res.on('close', () => {
      if (!responseSent) {
        handleError(new Error('Connection closed'));
      }
    });

    // Handle response finish
    res.on('finish', () => {
      if (!responseSent) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        // Clean up in-flight request if response finished without going through our handlers
        inFlightRequests.delete(cacheKey);
      }
    });

    // Handle errors from route handlers (next(error))
    const originalNext = next;
    next = function (err?: unknown) {
      if (err) {
        handleError(err instanceof Error ? err : new Error(String(err)));
      }
      return originalNext(err);
    } as NextFunction;

    // Call next() - the response methods will be called by the route handler
    next();
  };
}

/**
 * Invalidate cache entries matching a pattern
 */
export function invalidateCache(pattern: string): void {
  cache.deletePattern(pattern);
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  cache.clear();
}
