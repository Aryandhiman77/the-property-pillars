import { PrismaClient } from '@prisma/client';

import { env } from '../config/env.js';

const globalPrisma = globalThis as typeof globalThis & {
  __thePropertyPillarPrisma?: PrismaClient;
};

export const prisma =
  globalPrisma.__thePropertyPillarPrisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalPrisma.__thePropertyPillarPrisma = prisma;
}

export async function checkDatabaseConnection(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
