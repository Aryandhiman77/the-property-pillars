import type { RequestHandler } from 'express';

import {
  clearSessionCookie,
  getSessionCookie,
} from '../helpers/session-cookie.js';
import { sessionService } from '../services/session.service.js';
import type { AppRole } from '../types/auth.js';
import { ApiError } from '../utils/api-error.js';
import { asyncHandler } from '../utils/async-handler.js';

export const sessionContextMiddleware: RequestHandler = asyncHandler(
  async (request, response, next): Promise<void> => {
    const token = getSessionCookie(request);

    if (token) {
      request.session = await sessionService.resolve(token) ?? undefined;
      if (!request.session) clearSessionCookie(response);
    }

    next();
  },
);

export const requireSession: RequestHandler = (request, _response, next): void => {
  if (!request.session) {
    next(new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Please sign in to continue.'));
    return;
  }

  next();
};

export function requireRole(...roles: AppRole[]): RequestHandler {
  return (request, _response, next): void => {
    if (!request.session) {
      next(new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Please sign in to continue.'));
      return;
    }

    if (!roles.includes(request.session.role)) {
      next(new ApiError(403, 'ROLE_FORBIDDEN', 'Your active role cannot perform this action.'));
      return;
    }

    next();
  };
}
