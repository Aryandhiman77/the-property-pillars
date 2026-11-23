import type { Request, Response } from 'express';

import { env } from '../config/env.js';

const cookieBase = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export function getSessionCookie(request: Request): string | undefined {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[env.SESSION_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function setSessionCookie(
  response: Response,
  token: string,
  expiresAt: Date,
  persistent = true,
): void {
  response.cookie(env.SESSION_COOKIE_NAME, token, {
    ...cookieBase,
    ...(persistent ? { expires: expiresAt } : {}),
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(env.SESSION_COOKIE_NAME, cookieBase);
}
