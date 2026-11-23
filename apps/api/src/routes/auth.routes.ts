import { Router, type Router as ExpressRouter } from 'express';

import {
  getSession,
  logout,
  register,
  requestPasswordReset,
  resetPassword,
  resendVerification,
  signIn,
  verifyEmail,
} from '../controllers/auth.controller.js';
import { authRateLimiter } from '../middleware/rate-limit.middleware.js';
import {beginGoogle, createGoogleAccount, finishGoogle, getGoogleOnboarding} from '../controllers/google-auth.controller.js';
import { validateBody } from '../middleware/validate.middleware.js';
import {completeMobile, resendMobileEmail, startMobile, verifyMobile, verifyMobileEmail} from '../controllers/mobile-auth.controller.js';
import {
  registerSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  googleCompletionSchema,
  signInSchema,
  verifyEmailSchema,
} from '../schemas/auth.schema.js';

export const authRouter: ExpressRouter = Router();

authRouter.get('/session', getSession);
authRouter.post('/register', authRateLimiter, validateBody(registerSchema), register);
authRouter.post('/verify-email', authRateLimiter, validateBody(verifyEmailSchema), verifyEmail);
authRouter.post('/resend-verification', authRateLimiter, validateBody(signInSchema), resendVerification);
authRouter.post('/sign-in', authRateLimiter, validateBody(signInSchema), signIn);
authRouter.post('/password/reset/request', authRateLimiter, validateBody(requestPasswordResetSchema), requestPasswordReset);
authRouter.post('/password/reset/complete', authRateLimiter, validateBody(resetPasswordSchema), resetPassword);
authRouter.post('/logout', authRateLimiter, logout);
authRouter.get('/google/start', authRateLimiter, beginGoogle);
authRouter.get('/google/callback', authRateLimiter, finishGoogle);
authRouter.get('/google/onboarding', authRateLimiter, getGoogleOnboarding);
authRouter.post('/google/complete', authRateLimiter, validateBody(googleCompletionSchema), createGoogleAccount);
authRouter.post('/mobile/start', authRateLimiter, startMobile);
authRouter.post('/mobile/verify', authRateLimiter, verifyMobile);
authRouter.post('/mobile/complete', authRateLimiter, completeMobile);
authRouter.post('/mobile/complete/resend', authRateLimiter, resendMobileEmail);
authRouter.post('/mobile/complete/verify-email', authRateLimiter, verifyMobileEmail);
