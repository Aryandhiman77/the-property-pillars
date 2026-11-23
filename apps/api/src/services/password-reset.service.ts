import { prisma } from '../database/prisma.js';
import type { ResetPasswordInput } from '../schemas/auth.schema.js';
import { ApiError } from '../utils/api-error.js';
import { logger } from '../utils/logger.js';
import { hashPassword } from '../utils/password.js';
import {
  hashVerificationCode, newEmailCode, requireRegistrationEmail, sendPasswordResetEmail, verificationResendDelayMs,
} from './registration-email.service.js';

const eligibleAccount = {
  status: 'ACTIVE',
  emailVerifiedAt: { not: null },
  passwordHash: { not: null },
  tenant: { isDemo: false },
} as const;

export async function requestPasswordResetCode(email: string): Promise<void> {
  requireRegistrationEmail();
  const { code, hash, expiresAt } = newEmailCode();
  const updated = await prisma.user.updateMany({
    where: {
      ...eligibleAccount,
      email,
      OR: [
        { passwordResetExpiresAt: null },
        { passwordResetExpiresAt: { lte: new Date(expiresAt.getTime() - verificationResendDelayMs) } },
      ],
    },
    data: { passwordResetCodeHash: hash, passwordResetExpiresAt: expiresAt },
  });
  if (updated.count) {
    // Return the same public response without waiting for SMTP delivery.
    void sendPasswordResetEmail(email, code).catch(async () => {
      logger.warn('Password recovery email delivery failed');
      await prisma.user.updateMany({
        where: { email, passwordResetCodeHash: hash },
        data: { passwordResetCodeHash: null, passwordResetExpiresAt: null },
      }).catch(() => logger.warn('Could not clear the undelivered password reset code'));
    });
  }
}

function invalidCode() {
  const message = 'Enter the latest reset code or request a new one.';
  return new ApiError(422, 'PASSWORD_RESET_CODE_INVALID', message, [{ path: 'code', message }]);
}

export async function completePasswordReset(input: ResetPasswordInput): Promise<void> {
  const codeHash = hashVerificationCode(input.code);
  const account = await prisma.user.findFirst({
    where: { ...eligibleAccount, email: input.email, passwordResetCodeHash: codeHash, passwordResetExpiresAt: { gt: new Date() } },
    select: { id: true, tenantId: true, passwordHash: true },
  });
  if (!account?.passwordHash) throw invalidCode();

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: {
        ...eligibleAccount, id: account.id, email: input.email, passwordHash: account.passwordHash,
        passwordResetCodeHash: codeHash, passwordResetExpiresAt: { gt: new Date() },
      },
      data: { passwordHash, passwordResetCodeHash: null, passwordResetExpiresAt: null },
    });
    if (!updated.count) throw invalidCode();
    await tx.session.updateMany({
      where: { userId: account.id, tenantId: account.tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}
