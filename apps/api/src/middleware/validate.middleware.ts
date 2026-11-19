import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

import { ApiError } from '../utils/api-error.js';

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (request, _response, next): void => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      next(
        new ApiError(
          400,
          'VALIDATION_ERROR',
          'One or more fields are invalid.',
          result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        ),
      );
      return;
    }

    request.body = result.data;
    next();
  };
}
