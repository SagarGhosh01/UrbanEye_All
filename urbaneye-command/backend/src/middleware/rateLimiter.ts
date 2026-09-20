import rateLimit from 'express-rate-limit';

/**
 * Standard API rate limiter to protect SRIMS backend against DDoS and brute-force attacks.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP. Please try again in 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Stricter rate limiter for authentication endpoints (/api/auth/login)
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 auth requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts. Please wait 15 minutes before trying again.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
});

/**
 * High-throughput rate limiter for camera ingestion streams
 */
export const ingestionRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // 120 events / min per camera node
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Ingestion rate limit reached for this camera node.',
    code: 'INGESTION_RATE_LIMIT_EXCEEDED',
  },
});
