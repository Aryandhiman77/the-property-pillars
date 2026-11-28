import type { RequestHandler } from 'express';

import {Prisma} from "@prisma/client";
import {prisma} from "../database/prisma.js";
import {authService} from '../services/auth.service.js';
import {ApiError} from '../utils/api-error.js';
import { sendSuccess } from '../helpers/api-response.js';
import type { ChangePasswordInput, ProfileUpdateInput } from '../schemas/account.schema.js';
import { changeAccountPassword, getAccountProfile, updateAccountProfile } from '../services/account.service.js';
import { asyncHandler } from '../utils/async-handler.js';

export const getProfile: RequestHandler = asyncHandler(async (request, response) => {
  sendSuccess(response, await getAccountProfile(request.session!));
});

export const updateProfile: RequestHandler = asyncHandler(async (request, response) => {
  sendSuccess(response, await updateAccountProfile(request.session!, request.body as ProfileUpdateInput));
});

export const sendProfileEmailCode: RequestHandler = asyncHandler(async (request, response) => {
  const profile = await getAccountProfile(request.session!);
  const email = request.body.email ?? profile.email;
  if (!email || profile.emailVerifiedAt) throw new ApiError(409, 'EMAIL_VERIFICATION_NOT_PENDING', 'Enter an email address that needs verification.');
  if (email !== profile.email) {
    if(!profile.phoneVerifiedAt || profile.role==="ADMIN") throw new ApiError(403,"PHONE_VERIFICATION_REQUIRED","Verify your mobile number first.");
    try {
      const {count}=await prisma.user.updateMany({where:{id:profile.id,tenantId:request.session!.tenantId,email:profile.email,emailVerifiedAt:null},
        data:{email,emailVerificationCodeHash:null,emailVerificationExpiresAt:null,passwordResetCodeHash:null,passwordResetExpiresAt:null}});
      if(!count) throw new ApiError(409,"PROFILE_CHANGED","Reload your account and try again.");
    } catch(error) {
      if(error instanceof Prisma.PrismaClientKnownRequestError && error.code==="P2002") throw new ApiError(409,"EMAIL_IN_USE","This email is associated with another account.");
      throw error;
    }
  }
  await authService.sendEmailCode({id: profile.id, status: 'ACTIVE', email});
  sendSuccess(response, {sent: true});
});

export const verifyProfileEmail: RequestHandler = asyncHandler(async (request, response) => {
  await authService.confirmEmailCode({id: request.session!.userId, status: 'ACTIVE'}, request.body.code);
  sendSuccess(response, {verified: true});
});

export const changePassword: RequestHandler = asyncHandler(async (request, response) => {
  await changeAccountPassword(request.session!, request.body as ChangePasswordInput);
  sendSuccess(response, { changed: true });
});
