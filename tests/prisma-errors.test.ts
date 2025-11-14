import { Response } from 'express';
import { vi } from 'vitest';
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';

import {
  handlePrismaError,
  isPrismaForeignKeyError,
  isPrismaNotFoundError,
  isPrismaUniqueConstraintError,
} from '../src/utils/prisma-errors';

describe('Prisma Error Handling', () => {
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe('handlePrismaError', () => {
    it('should handle P2002 (unique constraint violation) with array target', () => {
      const error = new PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '6.19.0',
        meta: { target: ['email', 'username'] },
      });

      const result = handlePrismaError(error, mockRes as Response);

      expect(result).toBe(true);
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'A record with this email, username already exists',
        field: 'email',
      });
    });

    it('should handle P2002 (unique constraint violation) with string target', () => {
      const error = new PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '6.19.0',
        meta: { target: 'email' },
      });

      const result = handlePrismaError(error, mockRes as Response);

      expect(result).toBe(true);
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'A record with this email already exists',
        field: 'email',
      });
    });

    it('should handle P2002 (unique constraint violation) with no target', () => {
      const error = new PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '6.19.0',
        meta: {},
      });

      const result = handlePrismaError(error, mockRes as Response);

      expect(result).toBe(true);
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'A record with this field already exists',
        field: undefined,
      });
    });

    it('should handle P2003 (foreign key constraint violation)', () => {
      const error = new PrismaClientKnownRequestError('Foreign key constraint', {
        code: 'P2003',
        clientVersion: '6.19.0',
      });

      const result = handlePrismaError(error, mockRes as Response);

      expect(result).toBe(true);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Invalid reference: related record does not exist',
      });
    });

    it('should handle P2025 (record not found)', () => {
      const error = new PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '6.19.0',
      });

      const result = handlePrismaError(error, mockRes as Response);

      expect(result).toBe(true);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Record not found',
      });
    });

    it('should handle P2014 (invalid ID)', () => {
      const error = new PrismaClientKnownRequestError('Invalid ID', {
        code: 'P2014',
        clientVersion: '6.19.0',
      });

      const result = handlePrismaError(error, mockRes as Response);

      expect(result).toBe(true);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Invalid ID provided',
      });
    });

    it('should handle P2016 (query interpretation error)', () => {
      const error = new PrismaClientKnownRequestError('Query error', {
        code: 'P2016',
        clientVersion: '6.19.0',
      });

      const result = handlePrismaError(error, mockRes as Response);

      expect(result).toBe(true);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Invalid query parameters',
      });
    });

    it('should handle unknown Prisma error codes', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new PrismaClientKnownRequestError('Unknown error', {
        code: 'P9999',
        clientVersion: '6.19.0',
      });

      const result = handlePrismaError(error, mockRes as Response);

      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('Unhandled Prisma error:', 'P9999', 'Unknown error');
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Database error',
      });

      consoleSpy.mockRestore();
    });

    it('should handle PrismaClientValidationError', () => {
      const error = new PrismaClientValidationError('Validation failed', {
        clientVersion: '6.19.0',
      });

      const result = handlePrismaError(error, mockRes as Response);

      expect(result).toBe(true);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Invalid data provided',
        details: 'Validation failed',
      });
    });

    it('should return false for non-Prisma errors', () => {
      const error = new Error('Regular error');

      const result = handlePrismaError(error, mockRes as Response);

      expect(result).toBe(false);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should return false for null/undefined errors', () => {
      const result1 = handlePrismaError(null, mockRes as Response);
      const result2 = handlePrismaError(undefined, mockRes as Response);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });
  });

  describe('isPrismaNotFoundError', () => {
    it('should return true for P2025 error', () => {
      const error = new PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '6.19.0',
      });

      expect(isPrismaNotFoundError(error)).toBe(true);
    });

    it('should return false for other Prisma errors', () => {
      const error = new PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '6.19.0',
      });

      expect(isPrismaNotFoundError(error)).toBe(false);
    });

    it('should return false for non-Prisma errors', () => {
      expect(isPrismaNotFoundError(new Error('Regular error'))).toBe(false);
      expect(isPrismaNotFoundError(null)).toBe(false);
      expect(isPrismaNotFoundError(undefined)).toBe(false);
    });
  });

  describe('isPrismaUniqueConstraintError', () => {
    it('should return true for P2002 error', () => {
      const error = new PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '6.19.0',
      });

      expect(isPrismaUniqueConstraintError(error)).toBe(true);
    });

    it('should return false for other Prisma errors', () => {
      const error = new PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '6.19.0',
      });

      expect(isPrismaUniqueConstraintError(error)).toBe(false);
    });

    it('should return false for non-Prisma errors', () => {
      expect(isPrismaUniqueConstraintError(new Error('Regular error'))).toBe(false);
      expect(isPrismaUniqueConstraintError(null)).toBe(false);
    });
  });

  describe('isPrismaForeignKeyError', () => {
    it('should return true for P2003 error', () => {
      const error = new PrismaClientKnownRequestError('Foreign key constraint', {
        code: 'P2003',
        clientVersion: '6.19.0',
      });

      expect(isPrismaForeignKeyError(error)).toBe(true);
    });

    it('should return false for other Prisma errors', () => {
      const error = new PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '6.19.0',
      });

      expect(isPrismaForeignKeyError(error)).toBe(false);
    });

    it('should return false for non-Prisma errors', () => {
      expect(isPrismaForeignKeyError(new Error('Regular error'))).toBe(false);
      expect(isPrismaForeignKeyError(null)).toBe(false);
    });
  });
});
