import type { RequestHandler } from 'express';

import { logger } from '../utils/logger.js';

export const requestLoggerMiddleware: RequestHandler = (
  request,
  response,
  next,
): void => {
  const startedAt = process.hrtime.bigint();

  response.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.info('HTTP request completed', {
      requestId: request.requestId,
      method: request.method,
      path: request.originalUrl.split("?", 1)[0],
      statusCode: response.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    });
  });

  next();
};
