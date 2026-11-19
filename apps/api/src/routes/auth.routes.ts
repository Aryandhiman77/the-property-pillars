import { Router, type Router as ExpressRouter } from 'express';

import {
  getSession,
  logout,
  register,
  resendVerification,
  signIn,
  verifyEmail,
} from '../controllers/auth.controller.js';
import { authRateLimiter } from '../middleware/rate-limit.middleware.js';
import {beginGoogle, createGoogleAccount, finishGoogle} from '../controllers/google-auth.controller.js';
import { validateBody } from '../middleware/validate.middleware.js';
import {
  registerSchema,
  googleRoleSchema,
  signInSchema,
  verifyEmailSchema,
} from '../schemas/auth.schema.js';

export const authRouter: ExpressRouter = Router();

authRouter.get('/session', getSession);
authRouter.post('/register', authRateLimiter, validateBody(registerSchema), register);
authRouter.post('/verify-email', authRateLimiter, validateBody(verifyEmailSchema), verifyEmail);
authRouter.post('/resend-verification', authRateLimiter, validateBody(signInSchema), resendVerification);
authRouter.post('/sign-in', authRateLimiter, validateBody(signInSchema), signIn);
authRouter.post('/logout', authRateLimiter, logout);
authRouter.get('/google/start', authRateLimiter, beginGoogle);
authRouter.get('/google/callback', authRateLimiter, finishGoogle);
authRouter.post('/google/complete', authRateLimiter, validateBody(googleRoleSchema), createGoogleAccount);
