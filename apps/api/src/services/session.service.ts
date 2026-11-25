import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

import { prisma } from '../database/prisma.js';
import type { AuthSessionContext, AppRole } from '../types/auth.js';
import {
  createSessionToken,
  digestSessionToken,
  verifySessionToken,
} from '../utils/session-token.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

const LAST_SEEN_WRITE_INTERVAL_MS = 15 * 60 * 1_000;

export interface IssuedSession {
  token: string;
  expiresAt: Date;
  context: AuthSessionContext;
}

export class SessionService {
  async issue(input: {
    userId: string;
    tenantId: string;
    role: AppRole;
  } & ({passwordHash: string} | {googleSubject: string} | {verifiedPhone: string})): Promise<IssuedSession> {
    const sessionId = randomUUID();
    const expiresAt = new Date(
      Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1_000,
    );
    const token = await createSessionToken({
      sessionId,
      userId: input.userId,
      tenantId: input.tenantId,
      role: input.role,
      expiresAt,
    });
    const tokenHash = digestSessionToken(token);
    const credential = 'passwordHash' in input ? Prisma.sql`"passwordHash" = ${input.passwordHash}`
      : 'googleSubject' in input ? Prisma.sql`"googleSubject" = ${input.googleSubject}`
        : Prisma.sql`"phone" = ${input.verifiedPhone} AND "phoneVerifiedAt" IS NOT NULL`;
    const user = await prisma.$transaction(async (tx) => {
      // Serialize session issuance with password changes for the same account.
      const [current] = await tx.$queryRaw<{ fullName: string; profileLogoUrl: string | null }[]>`
        SELECT "fullName", "profileLogoUrl" FROM "User"
        WHERE "id" = ${input.userId} AND "tenantId" = ${input.tenantId}
          AND "role"::text = ${input.role} AND "status" = 'ACTIVE' AND ${credential}
        FOR UPDATE
      `;
      if (!current) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
      await tx.session.create({ data: {
        id: sessionId,
        userId: input.userId,
        tenantId: input.tenantId,
        tokenHash,
        activeRole: input.role,
        demo: false,
        expiresAt,
      } });
      return current;
    });

    return {
      token,
      expiresAt,
      context: {
        sessionId,
        userId: input.userId,
        tenantId: input.tenantId,
        role: input.role,
        name: user.fullName,
        ...(user.profileLogoUrl ? { logoUrl: user.profileLogoUrl } : {}),
      },
    };
  }

  async resolve(token: string): Promise<AuthSessionContext | null> {
    const claims = await verifySessionToken(token);
    if (!claims) return null;
    const tokenHash = digestSessionToken(token);
    const session = await prisma.session.findFirst({
      where: {
        id: claims.sessionId,
        tokenHash,
        demo: false,
      },
      include: {
        user: {
          select: {
            id: true,
            tenantId: true,
            fullName: true,
            profileLogoUrl: true,
            role: true,
            status: true,
          },
        },
        tenant: { select: { id: true, isDemo: true } },
      },
    });

    if (!session || session.revokedAt) return null;
    if (session.demo || session.tenant.isDemo) return null;

    const now = new Date();
    if (session.expiresAt <= now) {
      await prisma.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: now },
      });
      return null;
    }

    const tenantBoundaryIsValid =
      session.tenantId === session.user.tenantId &&
      session.tenantId === session.tenant.id &&
      claims.tenantId === session.tenantId;
    const identityBoundaryIsValid =
      claims.sessionId === session.id &&
      claims.userId === session.userId &&
      claims.userId === session.user.id;
    const roleBoundaryIsValid =
      claims.role === session.activeRole &&
      session.activeRole === session.user.role;

    if (
      session.user.status !== 'ACTIVE' ||
      !tenantBoundaryIsValid ||
      !identityBoundaryIsValid ||
      !roleBoundaryIsValid
    ) {
      return null;
    }

    if (
      now.getTime() - session.lastSeenAt.getTime() >=
      LAST_SEEN_WRITE_INTERVAL_MS
    ) {
      await prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: now },
      });
    }

    return {
      sessionId: session.id,
      userId: session.userId,
      tenantId: session.tenantId,
      role: session.user.role as AppRole,
      name: session.user.fullName,
      ...(session.user.profileLogoUrl ? { logoUrl: session.user.profileLogoUrl } : {}),
    };
  }

  async revokeToken(token: string): Promise<void> {
    await prisma.session.updateMany({
      where: {
        tokenHash: digestSessionToken(token),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }
}

export const sessionService = new SessionService();
