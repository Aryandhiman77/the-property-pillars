import { z } from 'zod';
import { isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';

import { SELF_REGISTERABLE_ROLES } from '../types/auth.js';

const selfRegisterableRoleTuple = SELF_REGISTERABLE_ROLES as [
  (typeof SELF_REGISTERABLE_ROLES)[number],
  ...(typeof SELF_REGISTERABLE_ROLES)[number][],
];

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email,
  password: z.string().min(10).max(128),
  role: z.enum(selfRegisterableRoleTuple),
  mobileCountry: z.string().trim().toUpperCase().max(2).optional(),
  mobileNumber: z.string().trim().max(32).optional(),
}).transform((input, context) => {
  if (!input.mobileNumber) return { ...input, phone: null };
  const country = input.mobileCountry as CountryCode | undefined;
  if (!country || !isSupportedCountry(country)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['mobileCountry'], message: 'Choose a valid country code.' });
    return z.NEVER;
  }
  const mobile = /^[\d ()-]+$/.test(input.mobileNumber)
    ? parsePhoneNumberFromString(input.mobileNumber, { defaultCountry: country, extract: false })
    : undefined;
  const type = mobile?.getType();
  if (!mobile || mobile.country !== input.mobileCountry || !mobile.isValid() || (type !== 'MOBILE' && type !== 'FIXED_LINE_OR_MOBILE')) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['mobileNumber'], message: 'Enter a valid mobile number for this country.' });
    return z.NEVER;
  }
  return { ...input, phone: mobile.number };
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const verifyEmailSchema = signInSchema.extend({
  code: z.string().max(48).transform((value) => value.replace(/[\s-]/g, '').toUpperCase())
    .pipe(z.string().regex(/^[A-F0-9]{16}$/, 'Enter the 16-character code from your email.')),
});

export const googleRoleSchema = z.object({role: z.enum(selfRegisterableRoleTuple)}).strict();
export type GoogleRoleInput = z.infer<typeof googleRoleSchema>;

export type RegisterInput = z.infer<typeof registerSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
