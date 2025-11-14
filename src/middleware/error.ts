import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: 'Route not found' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    // Extract the first error message for better user experience
    // If there's a single field error, return that message directly
    const flattened = err.flatten();
    const fieldErrors = flattened.fieldErrors as Record<string, string[] | undefined>;
    const firstErrorKey = Object.keys(fieldErrors)[0];
    const firstError = fieldErrors[firstErrorKey]?.[0];

    // If there's a single clear error message, use it; otherwise use generic message
    const message = firstError || 'Validation error';

    return res.status(400).json({
      message,
      errors: flattened,
    });
  }

  // Handle null/undefined errors
  if (err === null || err === undefined) {
    return res.status(500).json({ message: 'Internal Server Error' });
  }

  type WithStatus = { status?: unknown };
  const maybe = err as WithStatus;
  const status = typeof maybe.status === 'number' ? (maybe.status as number) : 500;
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  return res.status(status).json({ message });
}
