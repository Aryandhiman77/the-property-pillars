import type { RequestHandler } from 'express';

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

export const changePassword: RequestHandler = asyncHandler(async (request, response) => {
  await changeAccountPassword(request.session!, request.body as ChangePasswordInput);
  sendSuccess(response, { changed: true });
});
