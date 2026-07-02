import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
}

/**
 * Centralized error handler. Any error passed to next(err) — from route
 * handlers, validation middleware, or async controllers — lands here.
 * Must be registered LAST, after all routes.
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;

  logger.error(
    { err, method: req.method, path: req.path, statusCode },
    'Request error'
  );

  res.status(statusCode).json({
    error: {
      message: err.message || 'Internal server error',
      statusCode,
    },
  });
}

/** Wraps async route handlers so thrown/rejected errors reach errorHandler. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
