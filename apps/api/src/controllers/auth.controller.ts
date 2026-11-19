import type { RequestHandler } from 'express';

import {
  clearSessionCookie,
  getSessionCookie,
  setSessionCookie,
} from '../helpers/session-cookie.js';
import { sendSuccess } from '../helpers/api-response.js';
import type { RegisterInput, SignInInput, VerifyEmailInput } from '../schemas/auth.schema.js';
import { authService } from '../services/auth.service.js';
import { sessionService, type IssuedSession } from '../services/session.service.js';
import { ApiError } from '../utils/api-error.js';
import { asyncHandler } from '../utils/async-handler.js';

export async function replaceBrowserSession(
  requestToken: string | undefined,
  response: Parameters<RequestHandler>[1],
  issued: IssuedSession,
): Promise<void> {
  if (requestToken) await sessionService.revokeToken(requestToken);
  setSessionCookie(response, issued.token, issued.expiresAt);
}

export const getSession: RequestHandler = (request, response): void => {
  if (!request.session) {
    throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'No active session was found.');
  }

  sendSuccess(response, authService.toPublicSession(request.session));
};

export const register: RequestHandler = asyncHandler(async (request, response): Promise<void> => {
  await authService.register(request.body as RegisterInput);
  sendSuccess(response, { verificationRequired: true }, 201);
});

export const verifyEmail: RequestHandler = asyncHandler(async (request, response): Promise<void> => {
  await authService.verifyEmail(request.body as VerifyEmailInput);
  sendSuccess(response, { verified: true });
});

export const resendVerification: RequestHandler = asyncHandler(async (request, response): Promise<void> => {
  await authService.resendVerification(request.body as SignInInput);
  sendSuccess(response, { sent: true });
});

export const signIn: RequestHandler = asyncHandler(async (request, response): Promise<void> => {
  const issued = await authService.signIn(request.body as SignInInput);
  await replaceBrowserSession(getSessionCookie(request), response, issued);
  sendSuccess(response, authService.toPublicSession(issued.context));
});

export const logout: RequestHandler = asyncHandler(async (request, response): Promise<void> => {
  const token = getSessionCookie(request);
  if (token) await sessionService.revokeToken(token);
  clearSessionCookie(response);
  sendSuccess(response, { loggedOut: true });
});
