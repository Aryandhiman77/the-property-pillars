import { checkDatabaseConnection } from '../database/prisma.js';
import {
  livenessSchema,
  readinessSchema,
  type LivenessSnapshot,
  type ReadinessSnapshot,
} from '../schemas/health.schema.js';
import { logger } from '../utils/logger.js';

export class HealthService {
  getLiveness(): LivenessSnapshot {
    return livenessSchema.parse({
      status: 'ok',
      service: 'the-property-pillar-api',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  }

  async getReadiness(): Promise<ReadinessSnapshot> {
    try {
      await checkDatabaseConnection();

      return readinessSchema.parse({
        status: 'ready',
        service: 'the-property-pillar-api',
        timestamp: new Date().toISOString(),
        checks: { database: 'up' },
      });
    } catch (error) {
      logger.warn('Database readiness check failed', {
        error: error instanceof Error ? error.message : 'unknown error',
      });

      return readinessSchema.parse({
        status: 'not_ready',
        service: 'the-property-pillar-api',
        timestamp: new Date().toISOString(),
        checks: { database: 'down' },
      });
    }
  }
}

export const healthService = new HealthService();
