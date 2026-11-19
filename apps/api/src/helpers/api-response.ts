import type { Response } from 'express';

import type { ApiFailure, ApiSuccess } from '../types/api.js';

export function sendSuccess<T>(
  response: Response,
  data: T,
  statusCode = 200,
): Response<ApiSuccess<T>> {
  return response.status(statusCode).json({
    data,
    meta: {
      requestId: response.req.requestId,
      timestamp: new Date().toISOString(),
    },
  });
}

export function sendFailure(
  response: Response,
  input: {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  },
): Response<ApiFailure> {
  return response.status(input.statusCode).json({
    error: {
      code: input.code,
      message: input.message,
      ...(input.details === undefined ? {} : { details: input.details }),
      path: response.req.originalUrl,
    },
    meta: {
      requestId: response.req.requestId,
      timestamp: new Date().toISOString(),
    },
  });
}
