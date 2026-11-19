import { Router, type Router as ExpressRouter } from 'express';

import {
  getLiveness,
  getReadiness,
} from '../controllers/health.controller.js';

export const healthRouter: ExpressRouter = Router();

healthRouter.get('/health', getLiveness);
healthRouter.get('/health/ready', getReadiness);
