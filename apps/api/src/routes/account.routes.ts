import { Router, type Router as ExpressRouter } from 'express';

import { changePassword, getProfile, updateProfile } from '../controllers/account.controller.js';
import { authRateLimiter } from '../middleware/rate-limit.middleware.js';
import { requireSession } from '../middleware/session.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { changePasswordSchema, profileUpdateSchema } from '../schemas/account.schema.js';

export const accountRouter: ExpressRouter = Router();

accountRouter.use(requireSession);
accountRouter.get('/profile', getProfile);
accountRouter.patch('/profile', validateBody(profileUpdateSchema), updateProfile);
accountRouter.post('/password', authRateLimiter, validateBody(changePasswordSchema), changePassword);
