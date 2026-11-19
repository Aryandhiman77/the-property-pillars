import type { ErrorRequestHandler } from 'express';

import { sendFailure } from '../helpers/api-response.js';
import { ApiError } from '../utils/api-error.js';
import { logger } from '../utils/logger.js';

export const errorMiddleware: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  _next,
): void => {
  if (response.headersSent) {
    _next(error);
    return;
  }

  if (error instanceof ApiError) {
    sendFailure(response, {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return;
  }

  const invalidJson =
    error instanceof SyntaxError &&
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.parse.failed';

  if (invalidJson) {
    sendFailure(response, {
      statusCode: 400,
      code: 'INVALID_JSON',
      message: 'The request body is not valid JSON.',
    });
    return;
  }

  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
    sendFailure(response, {
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'The request exceeds the allowed size.',
    });
    return;
  }

  logger.error('Unhandled request error', {
    requestId: request.requestId,
    method: request.method,
    path: request.originalUrl,
    error: error instanceof Error ? error.message : 'unknown error',
    stack: envStack(error),
  });
  sendFailure(response, {
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred.',
  });
};

function envStack(error: unknown): string | undefined {
  return process.env.NODE_ENV === 'production' || !(error instanceof Error)
    ? undefined
    : error.stack;
}
