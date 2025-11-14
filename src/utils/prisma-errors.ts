import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';
import { Response } from 'express';

/**
 * Prisma error codes:
 * - P2002: Unique constraint violation
 * - P2003: Foreign key constraint violation
 * - P2025: Record not found (used in update/delete operations)
 * - P2014: Invalid ID provided
 * - P2016: Query interpretation error
 */
export function handlePrismaError(error: unknown, res: Response): boolean {
  // Handle Prisma known request errors
  if (error instanceof PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        // Unique constraint violation
        const target = error.meta?.target;
        const field = Array.isArray(target) ? target.join(', ') : target || 'field';
        res.status(409).json({
          message: `A record with this ${field} already exists`,
          field: Array.isArray(target) ? target[0] : target,
        });
        return true;
      }

      case 'P2003': {
        // Foreign key constraint violation
        res.status(400).json({
          message: 'Invalid reference: related record does not exist',
        });
        return true;
      }

      case 'P2025': {
        // Record not found (used in update/delete operations)
        res.status(404).json({
          message: 'Record not found',
        });
        return true;
      }

      case 'P2014': {
        // Invalid ID provided
        res.status(400).json({
          message: 'Invalid ID provided',
        });
        return true;
      }

      case 'P2016': {
        // Query interpretation error
        res.status(400).json({
          message: 'Invalid query parameters',
        });
        return true;
      }

      default: {
        // Other Prisma errors - log and return 500
        console.error('Unhandled Prisma error:', error.code, error.message);
        res.status(500).json({
          message: 'Database error',
        });
        return true;
      }
    }
  }

  // Handle Prisma validation errors
  if (error instanceof PrismaClientValidationError) {
    res.status(400).json({
      message: 'Invalid data provided',
      details: error.message,
    });
    return true;
  }

  // Not a Prisma error
  return false;
}

/**
 * Check if a Prisma error is a "not found" error (P2025)
 */
export function isPrismaNotFoundError(error: unknown): boolean {
  return error instanceof PrismaClientKnownRequestError && error.code === 'P2025';
}

/**
 * Check if a Prisma error is a unique constraint violation (P2002)
 */
export function isPrismaUniqueConstraintError(error: unknown): boolean {
  return error instanceof PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Check if a Prisma error is a foreign key constraint violation (P2003)
 */
export function isPrismaForeignKeyError(error: unknown): boolean {
  return error instanceof PrismaClientKnownRequestError && error.code === 'P2003';
}
