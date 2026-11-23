import { Prisma } from '@prisma/client';

import { prisma } from '../database/prisma.js';
import type { ChangePasswordInput, ProfileUpdateInput } from '../schemas/account.schema.js';
import type { AuthSessionContext } from '../types/auth.js';
import { canAttachImage, uploadedImageExists } from '../uploads/images.js';
import { ApiError } from '../utils/api-error.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

const profileFields = { fullName: true, email: true, phone: true, pendingRegistrationPhone: true, phoneVerifiedAt: true, role: true, aboutMe: true, profileLocation: true, profileLogoUrl: true } as const;
type ProfileRecord = Prisma.UserGetPayload<{ select: typeof profileFields }>;

function activeAccount(session: AuthSessionContext) {
  return { id: session.userId, tenantId: session.tenantId, status: 'ACTIVE' as const };
}

function profileDetails(user: ProfileRecord | null | undefined) {
  if (!user) throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Please sign in to continue.');
  const { profileLocation, profileLogoUrl, pendingRegistrationPhone, ...profile } = user;
  return { ...profile, phone: profile.phone ?? pendingRegistrationPhone, location: profileLocation, logoUrl: profileLogoUrl };
}

export async function getAccountProfile(session: AuthSessionContext) {
  return profileDetails(await prisma.user.findUnique({ where: activeAccount(session), select: profileFields }));
}

export async function updateAccountProfile(session: AuthSessionContext, input: ProfileUpdateInput) {
  if (input.logoUrl && !(await canAttachImage(input.logoUrl, session, 'account:logoUrl'))) {
    const current = await prisma.user.findUnique({where: activeAccount(session), select: {profileLogoUrl: true}});
    if (current?.profileLogoUrl !== input.logoUrl || !(await uploadedImageExists(input.logoUrl))) {
      const message = 'Upload the logo again.';
      throw new ApiError(422, 'LOGO_NOT_FOUND', message, [{path: 'logoUrl', message}]);
    }
  }
  const [updated] = await prisma.user.updateManyAndReturn({
    where: {...activeAccount(session), ...(input.phone === undefined ? {} : {OR: [{phoneVerifiedAt: null}, {phone: input.phone}]})},
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.aboutMe !== undefined ? { aboutMe: input.aboutMe || null } : {}),
      ...(input.location !== undefined ? { profileLocation: input.location || null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone, pendingRegistrationPhone: null } : {}),
      ...(input.logoUrl !== undefined ? { profileLogoUrl: input.logoUrl } : {}),
    },
    select: profileFields,
  }).catch((error: unknown) => {
    if (input.phone && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const message = 'This mobile number is already used by another account.';
      throw new ApiError(409, 'PHONE_IN_USE', message, [{path: 'phone', message}]);
    }
    throw error;
  });
  if (!updated && input.phone !== undefined && await prisma.user.findUnique({where: activeAccount(session), select: {id: true}})) {
    throw new ApiError(422, "MOBILE_VERIFICATION_REQUIRED", "Verify your new mobile number before saving it.", {phone: ["Verify your new mobile number before saving it."]});
  }
  return profileDetails(updated);
}

export async function changeAccountPassword(session: AuthSessionContext, input: ChangePasswordInput) {
  const where = activeAccount(session);
  const user = await prisma.user.findUnique({ where, select: { passwordHash: true } });
  if (!user) throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Please sign in to continue.');
  const previousHash = user.passwordHash;
  if (!previousHash || !(await verifyPassword(input.currentPassword, previousHash))) {
    const message = 'Your current password is incorrect.';
    throw new ApiError(422, 'CURRENT_PASSWORD_INCORRECT', message, [{ path: 'currentPassword', message }]);
  }
  const passwordHash = await hashPassword(input.newPassword);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { ...where, passwordHash: previousHash },
      data: { passwordHash, passwordResetCodeHash: null, passwordResetExpiresAt: null },
    });
    if (!updated.count) {
      const message = 'Enter your current password again.';
      throw new ApiError(409, 'PASSWORD_CHANGE_CONFLICT', message, [{ path: 'currentPassword', message }]);
    }
    await tx.session.updateMany({
      where: { userId: session.userId, tenantId: session.tenantId, id: { not: session.sessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}
