/**
 * Error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import { toApiError, isAppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiError = toApiError(err);

  // Log error
  if (isAppError(err) && err.statusCode < 500) {
    logger.warn('Request error', {
      method: req.method,
      path: req.path,
      statusCode: apiError.statusCode,
      message: apiError.message,
    });
  } else {
    logger.error('Internal server error', {
      method: req.method,
      path: req.path,
      statusCode: apiError.statusCode,
      message: apiError.message,
      stack: err instanceof Error ? err.stack : undefined,
    });
  }

  res.status(apiError.statusCode || 500).json({
    error: {
      message: apiError.message,
      code: apiError.code,
      ...(apiError.details && { details: apiError.details }),
    },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'NOT_FOUND',
    },
  });
}

