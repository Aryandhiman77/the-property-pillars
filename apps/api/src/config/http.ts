import type { CorsOptions } from 'cors';

import { env } from './env.js';
import { ApiError } from '../utils/api-error.js';

const allowedOrigins = new Set(env.allowedOrigins);

export const corsOptions: CorsOptions = {
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(
      new ApiError(
        403,
        'ORIGIN_NOT_ALLOWED',
        'The requesting origin is not allowed to access this API.',
      ),
    );
  },
};
