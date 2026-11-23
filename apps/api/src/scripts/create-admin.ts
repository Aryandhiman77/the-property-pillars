import { z } from 'zod';

import { env } from '../config/env.js';
import { disconnectDatabase, prisma } from '../database/prisma.js';
import { getOrCreateMarketplaceTenant } from '../database/tenant.js';
import { hashPassword } from '../utils/password.js';

const inputSchema = z.object({
  ADMIN_EMAIL: z.string().trim().email().transform((value) => value.toLowerCase()),
  ADMIN_NAME: z.string().trim().min(2).max(100),
  ADMIN_PASSWORD: z.string().min(14).max(128),
});

async function createOrRotateAdmin(): Promise<void> {
  if (
    env.NODE_ENV === 'production' &&
    process.env.ALLOW_ADMIN_BOOTSTRAP !== 'true'
  ) {
    throw new Error(
      'Production admin bootstrap requires ALLOW_ADMIN_BOOTSTRAP=true for this one command.',
    );
  }

  const input = inputSchema.parse(process.env);
  const passwordHash = await hashPassword(input.ADMIN_PASSWORD);
  const marketplaceTenant = await getOrCreateMarketplaceTenant();
  const existing = await prisma.user.findUnique({
    where: { email: input.ADMIN_EMAIL },
    include: { tenant: { select: { isDemo: true } } },
  });

  if (existing) {
    if (existing.role !== 'ADMIN' || existing.tenant.isDemo || existing.tenantId !== marketplaceTenant.id) {
      throw new Error(
        'This email belongs to an account outside the marketplace administrator scope.',
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: existing.id },
        data: { fullName: input.ADMIN_NAME, passwordHash, status: 'ACTIVE', passwordResetCodeHash: null, passwordResetExpiresAt: null },
      }),
      prisma.session.updateMany({
        where: { userId: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    console.info(`Updated credentials for admin ${input.ADMIN_EMAIL}.`);
    return;
  }

  await prisma.user.create({
    data: {
      tenantId: marketplaceTenant.id,
      email: input.ADMIN_EMAIL,
      fullName: input.ADMIN_NAME,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.info(`Created admin ${input.ADMIN_EMAIL}.`);
}

try {
  await createOrRotateAdmin();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Admin bootstrap failed.');
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
