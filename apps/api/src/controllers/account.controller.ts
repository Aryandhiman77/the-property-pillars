import type { RequestHandler } from 'express';

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
  if (!profile.email || profile.emailVerifiedAt) throw new ApiError(409, 'EMAIL_VERIFICATION_NOT_PENDING', 'There is no email awaiting verification.');
  await authService.sendEmailCode({id: request.session!.userId, status: 'ACTIVE', email: profile.email});
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
