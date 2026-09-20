import { Request, Response, NextFunction } from 'express';

/**
 * Global Enterprise Error Handler for SRIMS Backend.
 * Prevents crash unhandled rejections, sanitizes internal stack traces in production,
 * and returns standardized JSON error envelopes.
 */
export function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ❌ Backend Exception on ${req.method} ${req.url}:`, err.stack || err.message || err);

  const statusCode = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    status: 'ERROR',
    error: err.message || 'An unexpected backend error occurred.',
    code: err.code || 'INTERNAL_SERVER_ERROR',
    timestamp,
    ...(isProduction ? {} : { stack: err.stack }),
  });
}
