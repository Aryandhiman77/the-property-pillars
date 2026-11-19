import { createHash } from 'node:crypto';

import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';

import { env } from '../config/env.js';
import { USER_ROLES, type AppRole } from '../types/auth.js';

const JWT_ALGORITHM = 'HS256';
const encodedSecret = new TextEncoder().encode(env.JWT_SECRET);

const sessionClaimsSchema = z.object({
  sub: z.string().min(1),
  jti: z.string().min(1),
  tenantId: z.string().min(1),
  role: z.enum(USER_ROLES),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
});

export interface SessionTokenClaims {
  sessionId: string;
  userId: string;
  tenantId: string;
  role: AppRole;
  issuedAt: number;
  expiresAt: number;
}

export async function createSessionToken(input: {
  sessionId: string;
  userId: string;
  tenantId: string;
  role: AppRole;
  expiresAt: Date;
}): Promise<string> {
  return new SignJWT({tenantId: input.tenantId, role: input.role})
    .setProtectedHeader({alg: JWT_ALGORITHM, typ: 'JWT'})
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setSubject(input.userId)
    .setJti(input.sessionId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(input.expiresAt.getTime() / 1000))
    .sign(encodedSecret);
}

export async function verifySessionToken(
  token: string,
): Promise<SessionTokenClaims | null> {
  try {
    const verified = await jwtVerify(token, encodedSecret, {
      algorithms: [JWT_ALGORITHM],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      clockTolerance: env.JWT_CLOCK_TOLERANCE_SECONDS,
    });
    if (verified.protectedHeader.typ !== 'JWT') return null;
    const claims = sessionClaimsSchema.safeParse(verified.payload);
    if (!claims.success) return null;

    return {
      sessionId: claims.data.jti,
      userId: claims.data.sub,
      tenantId: claims.data.tenantId,
      role: claims.data.role,
      issuedAt: claims.data.iat,
      expiresAt: claims.data.exp,
    };
  } catch {
    return null;
  }
}

export function digestSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
