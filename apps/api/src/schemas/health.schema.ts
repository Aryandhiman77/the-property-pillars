import { z } from 'zod';

export const livenessSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('the-property-pillar-api'),
  timestamp: z.string().datetime(),
  uptimeSeconds: z.number().int().nonnegative(),
});

export const readinessSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  service: z.literal('the-property-pillar-api'),
  timestamp: z.string().datetime(),
  checks: z.object({
    database: z.enum(['up', 'down']),
  }),
});

export type LivenessSnapshot = z.infer<typeof livenessSchema>;
export type ReadinessSnapshot = z.infer<typeof readinessSchema>;
