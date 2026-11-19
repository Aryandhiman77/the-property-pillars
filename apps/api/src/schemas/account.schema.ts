import { z } from 'zod';

import { uploadedImageName } from '../uploads/images.js';

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter at least 2 characters.').max(100).optional(),
  aboutMe: z.string().trim().max(1000).nullable().optional(),
  location: z.string().trim().max(160).nullable().optional(),
  logoUrl: z.string().refine(uploadedImageName, 'Upload a logo using the file picker.').nullable().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'Enter at least one profile change.');

export const changePasswordSchema = z.object({
  currentPassword: z.string({ required_error: 'Enter your current password.' }).min(1, 'Enter your current password.').max(128),
  newPassword: z.string({ required_error: 'Enter a new password.' }).min(10, 'Use at least 10 characters.').max(128),
  confirmNewPassword: z.string({ required_error: 'Confirm your new password.' }).min(1, 'Confirm your new password.').max(128),
}).strict().superRefine((data, context) => {
  if (data.currentPassword && data.newPassword === data.currentPassword) {
    context.addIssue({ code: 'custom', path: ['newPassword'], message: 'Choose a different password.' });
  }
  if (data.confirmNewPassword && data.confirmNewPassword !== data.newPassword) {
    context.addIssue({ code: 'custom', path: ['confirmNewPassword'], message: 'Passwords do not match.' });
  }
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
