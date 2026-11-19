import type { RequestHandler } from 'express';

import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const allowedOrigins = new Set(env.allowedOrigins);

function originFromRequest(origin: string | undefined, referer: string | undefined): string | null {
  if (origin) return origin;
  if (!referer) return null;

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export const trustedOriginMiddleware: RequestHandler = (
  request,
  _response,
  next,
): void => {
  if (SAFE_METHODS.has(request.method) || env.NODE_ENV === 'test') {
    next();
    return;
  }

  const requestOrigin = originFromRequest(
    request.header('origin'),
    request.header('referer'),
  );

  if (!requestOrigin || !allowedOrigins.has(requestOrigin)) {
    next(
      new ApiError(
        403,
        'UNTRUSTED_ORIGIN',
        'This write request did not come from an allowed application origin.',
      ),
    );
    return;
  }

  next();
};
