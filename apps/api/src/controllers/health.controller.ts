import type { RequestHandler } from 'express';

import { sendSuccess } from '../helpers/api-response.js';
import { healthService } from '../services/health.service.js';
import { ApiError } from '../utils/api-error.js';
import { asyncHandler } from '../utils/async-handler.js';

export const getLiveness: RequestHandler = (_request, response): void => {
  sendSuccess(response, healthService.getLiveness());
};

export const getReadiness: RequestHandler = asyncHandler(
  async (_request, response): Promise<void> => {
    const snapshot = await healthService.getReadiness();

    if (snapshot.status !== 'ready') {
      throw new ApiError(
        503,
        'SERVICE_NOT_READY',
        'The API is running but a required dependency is unavailable.',
        snapshot,
      );
    }

    sendSuccess(response, snapshot);
  },
);
