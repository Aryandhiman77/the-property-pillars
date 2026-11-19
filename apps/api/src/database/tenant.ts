import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';
import { prisma } from './prisma.js';

export async function getOrCreateMarketplaceTenant() {
  const where = { id: env.PUBLIC_TENANT_ID };
  let tenant = await prisma.tenant.findUnique({ where });
  if (!tenant) {
    await prisma.tenant.createMany({
      skipDuplicates: true,
      data: {
        id: env.PUBLIC_TENANT_ID,
        name: 'ThePropertyPillar Marketplace',
        isDemo: false,
      },
    });
    tenant = await prisma.tenant.findUniqueOrThrow({ where });
  }

  if (tenant.isDemo) {
    throw new ApiError(
      500,
      'MARKETPLACE_TENANT_INVALID',
      'The configured public marketplace tenant is not valid.',
    );
  }

  return tenant;
}
