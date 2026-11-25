import { Prisma, type UserStatus } from '@prisma/client';

import { prisma } from '../database/prisma.js';
import { getOrCreateMarketplaceTenant } from '../database/tenant.js';
import type { RegisterInput, SignInInput, VerifyEmailInput } from '../schemas/auth.schema.js';
import type { AuthSessionContext, AppRole } from '../types/auth.js';
import { ApiError } from '../utils/api-error.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { sessionService, type IssuedSession } from './session.service.js';
import {
  hashVerificationCode, newVerificationCode, requireRegistrationEmail, sendVerificationEmail,
  verificationLifetimeMs, verificationResendDelayMs,
} from './registration-email.service.js';

export interface PublicSession {
  role: AppRole;
  name: string;
  logoUrl?: string;
}

function publicSession(context: AuthSessionContext): PublicSession {
  return {
    role: context.role,
    name: context.name,
    ...(context.logoUrl ? { logoUrl: context.logoUrl } : {}),
  };
}

function verificationRequired() {
  return new ApiError(403, 'EMAIL_VERIFICATION_REQUIRED', 'Verify your email before signing in.');
}

function mobileAlreadyRegistered() {
  const message = 'This mobile number is already linked to an account.';
  return new ApiError(409, 'MOBILE_ALREADY_REGISTERED', message, [{ path: 'mobileNumber', message }]);
}

export class AuthService {
  toPublicSession(context: AuthSessionContext): PublicSession {
    return publicSession(context);
  }

  async register(input: RegisterInput): Promise<IssuedSession> {
    if (input.phone && await prisma.user.findUnique({ where: { phone: input.phone }, select: { id: true } })) {
      throw mobileAlreadyRegistered();
    }
    const passwordHash = await hashPassword(input.password);
    const tenant = await getOrCreateMarketplaceTenant();
    try {
      const user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          fullName: input.fullName,
          email: input.email,
          pendingRegistrationPhone: input.phone,
          passwordHash,
          role: input.role,
          status: 'ACTIVE',
        },
      });
      return sessionService.issue({userId: user.id, tenantId: user.tenantId, role: user.role, passwordHash});
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiError(
          409,
          'EMAIL_ALREADY_REGISTERED',
          'An account already exists for this email address.',
        );
      }
      throw error;
    }
  }

  private async checkCredentials(input: SignInInput) {
    const include = {tenant: {select: {isDemo: true}}} as const;
    const byPhone = !input.email.includes('@');
    let user = await prisma.user.findUnique({where: byPhone ? {phone: input.email} : {email: input.email}, include});
    if (!user && byPhone) {
      const candidates = await prisma.user.findMany({where: {pendingRegistrationPhone: input.email, status: 'ACTIVE'}, include, take: 2});
      if (candidates.length === 1) user = candidates[0];
    }

    if (!user?.passwordHash || user.tenant.isDemo || !['ACTIVE', 'PENDING'].includes(user.status) ||
        !(await verifyPassword(input.password, user.passwordHash))) {
      throw new ApiError(
        401,
        'INVALID_CREDENTIALS',
        'Email, mobile number or password is incorrect.',
      );
    }
    return { ...user, passwordHash: user.passwordHash };
  }

  async signIn(input: SignInInput): Promise<IssuedSession> {
    const user = await this.checkCredentials(input);
    if (user.status !== 'ACTIVE') throw verificationRequired();

    return sessionService.issue({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role as AppRole,
      passwordHash: user.passwordHash,
    });
  }

  private async pendingRegistration(input: SignInInput) {
    const user = await this.checkCredentials(input);
    if (user.emailVerifiedAt || !user.email || (user.status === 'PENDING' && (user.role === 'ADMIN' || !user.emailVerificationCodeHash))) {
      throw new ApiError(409, 'EMAIL_VERIFICATION_NOT_PENDING', 'There is no pending email verification for this account.');
    }
    return {id: user.id, status: user.status, email: user.email};
  }

  async verifyEmail(input: VerifyEmailInput): Promise<void> {
    const user = await this.pendingRegistration(input);
    await this.confirmEmailCode(user, input.code);
  }

  async confirmEmailCode(user: {id: string; status: UserStatus}, code: string): Promise<void> {
    const now = new Date();
    const updated = await prisma.user.updateMany({
      where: {
        id: user.id,
        status: user.status, emailVerifiedAt: null,
        emailVerificationCodeHash: hashVerificationCode(code),
        emailVerificationExpiresAt: { gt: now },
      },
      data: {
        status: 'ACTIVE',
        emailVerifiedAt: now,
        emailVerificationCodeHash: null,
        emailVerificationExpiresAt: null,
      },
    });
    if (updated.count === 0) {
      throw new ApiError(400, 'EMAIL_VERIFICATION_CODE_INVALID', 'The email code is incorrect or expired.', [
        { path: 'code', message: 'Enter the latest code or request a new one.' },
      ]);
    }
  }

  async resendVerification(input: SignInInput): Promise<void> {
    const user = await this.pendingRegistration(input);
    await this.sendEmailCode(user);
  }

  async sendEmailCode(user: {id: string; status: UserStatus; email: string}): Promise<void> {
    requireRegistrationEmail();
    const verification = newVerificationCode();
    const updated = await prisma.user.updateMany({
      where: {
        id: user.id,
        status: user.status, emailVerifiedAt: null,
        OR: [{emailVerificationExpiresAt: null}, {emailVerificationExpiresAt: {lte: new Date(Date.now() + verificationLifetimeMs - verificationResendDelayMs)}}],
      },
      data: verification.data,
    });
    if (updated.count === 0) {
      throw new ApiError(429, 'EMAIL_VERIFICATION_COOLDOWN', 'Wait one minute between verification emails, then try again.');
    }
    try {
      await sendVerificationEmail(user.email, verification.code);
    } catch (error) {
      await prisma.user.updateMany({where: {id: user.id, emailVerificationCodeHash: verification.data.emailVerificationCodeHash},
        data: {emailVerificationExpiresAt: null, emailVerificationCodeHash: null}});
      throw error;
    }
  }
}

export const authService = new AuthService();
