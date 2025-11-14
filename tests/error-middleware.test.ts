import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { vi } from 'vitest';

import { errorHandler, notFoundHandler } from '../src/middleware/error';

describe('Error Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('notFoundHandler', () => {
    it('should return 404 with message', () => {
      notFoundHandler(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Route not found' });
    });
  });

  describe('errorHandler', () => {
    it('should handle ZodError with 400 status', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['email'],
          message: 'Expected string, received number',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      ]);

      errorHandler(zodError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Expected string, received number', // Updated to match new error handler behavior
        errors: zodError.flatten(),
      });
    });

    it('should handle Error with status property', () => {
      const error = Object.assign(new Error('Custom error'), { status: 403 });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Custom error' });
    });

    it('should handle Error without status property (defaults to 500)', () => {
      const error = new Error('Internal error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Internal error' });
    });

    it('should handle non-Error objects with status property', () => {
      const error = { status: 401, message: 'Unauthorized' };

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
    });

    it('should handle non-Error objects without status property', () => {
      const error = { message: 'Some error' };

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
    });

    it('should handle null/undefined errors', () => {
      errorHandler(null, mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });

      errorHandler(undefined, mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
    });

    it('should handle status property that is not a number', () => {
      const error = Object.assign(new Error('Error'), { status: 'not-a-number' });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error' });
    });
  });
});
