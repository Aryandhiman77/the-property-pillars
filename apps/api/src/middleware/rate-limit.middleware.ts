import { rateLimit } from 'express-rate-limit';

import { env } from '../config/env.js';
import { sendFailure } from '../helpers/api-response.js';

function limiter(max: number) {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_request, response) => {
      sendFailure(response, {
        statusCode: 429,
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again shortly.',
      });
    },
  });
}

export const globalRateLimiter = limiter(env.RATE_LIMIT_MAX);
export const authRateLimiter = limiter(env.AUTH_RATE_LIMIT_MAX);
