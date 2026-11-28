import { Router, type Router as ExpressRouter } from 'express';

import {z} from 'zod';
import {emailCode} from '../schemas/auth.schema.js';
import { changePassword, getProfile, updateProfile, sendProfileEmailCode, verifyProfileEmail } from '../controllers/account.controller.js';
import { authRateLimiter } from '../middleware/rate-limit.middleware.js';
import { requireSession } from '../middleware/session.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { changePasswordSchema, profileUpdateSchema } from '../schemas/account.schema.js';

export const accountRouter: ExpressRouter = Router();

accountRouter.use(requireSession);
accountRouter.get('/profile', getProfile);
accountRouter.patch('/profile', validateBody(profileUpdateSchema), updateProfile);
accountRouter.post('/email/code', authRateLimiter, validateBody(z.object({email:z.string().trim().toLowerCase().email().max(254).optional()}).strict()), sendProfileEmailCode);
accountRouter.post('/email/verify', authRateLimiter, validateBody(z.object({code: emailCode})), verifyProfileEmail);
accountRouter.post('/password', authRateLimiter, validateBody(changePasswordSchema), changePassword);
