import type { RequestHandler } from 'express';

import {
  clearSessionCookie,
  getSessionCookie,
  setSessionCookie,
} from '../helpers/session-cookie.js';
import { sendSuccess } from '../helpers/api-response.js';
import type { RegisterInput, ResetPasswordInput, SignInInput, VerifyEmailInput } from '../schemas/auth.schema.js';
import { authService } from '../services/auth.service.js';
import { requestPasswordResetCode, completePasswordReset } from '../services/password-reset.service.js';
import { sessionService, type IssuedSession } from '../services/session.service.js';
import { ApiError } from '../utils/api-error.js';
import { asyncHandler } from '../utils/async-handler.js';

export async function replaceBrowserSession(
  requestToken: string | undefined,
  response: Parameters<RequestHandler>[1],
  issued: IssuedSession,
  persistent = true,
): Promise<void> {
  if (requestToken) await sessionService.revokeToken(requestToken);
  setSessionCookie(response, issued.token, issued.expiresAt, persistent);
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
  const input = request.body as SignInInput;
  const issued = await authService.signIn(input);
  await replaceBrowserSession(getSessionCookie(request), response, issued, input.rememberMe ?? true);
  sendSuccess(response, authService.toPublicSession(issued.context));
});

export const requestPasswordReset: RequestHandler = asyncHandler(async (request, response) => {
  await requestPasswordResetCode((request.body as {email: string}).email);
  sendSuccess(response, { received: true });
});

export const resetPassword: RequestHandler = asyncHandler(async (request, response) => {
  await completePasswordReset(request.body as ResetPasswordInput);
  sendSuccess(response, { reset: true });
});

export const logout: RequestHandler = asyncHandler(async (request, response): Promise<void> => {
  const token = getSessionCookie(request);
  if (token) await sessionService.revokeToken(token);
  clearSessionCookie(response);
  sendSuccess(response, { loggedOut: true });
});
