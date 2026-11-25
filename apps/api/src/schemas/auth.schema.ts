import { z } from 'zod';
import {blockedListingWords} from "@the-property-pillar/contracts";
import { isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';

import { SELF_REGISTERABLE_ROLES } from '../types/auth.js';

const selfRegisterableRoleTuple = SELF_REGISTERABLE_ROLES as [
  (typeof SELF_REGISTERABLE_ROLES)[number],
  ...(typeof SELF_REGISTERABLE_ROLES)[number][],
];

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const registrationRole = z.enum(selfRegisterableRoleTuple);
const publicName = z.string().trim().min(2, "Enter your full name.").max(100)
  .refine(name => !blockedListingWords("fullName", name).length, "Choose a display name without abusive or promotional wording.");

export const registerSchema = z.object({
  fullName: publicName,
  email,
  password: z.string().min(10).max(128),
  role: registrationRole,
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

const loginIdentifier = z.string().trim().max(254).transform((value, ctx) => {
  if (value.includes('@')) {
    const parsed = email.safeParse(value);
    if (parsed.success) return parsed.data;
    ctx.addIssue({code: z.ZodIssueCode.custom, message: 'Enter a valid email address.'});
    return z.NEVER;
  }
  const mobile = parsePhoneNumberFromString(value, {defaultCountry: 'IN', extract: false});
  if (mobile?.isValid()) return mobile.number;
  ctx.addIssue({code: z.ZodIssueCode.custom, message: 'Enter an email or a valid mobile number with country code.'});
  return z.NEVER;
});

export const signInSchema = z.object({
  email: loginIdentifier,
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().optional(),
});

export const emailCode = z.string().max(48).transform((value) => value.replace(/[\s-]/g, '').toUpperCase())
  .pipe(z.string().regex(/^[A-F0-9]{16}$/, 'Enter the 16-character code from your email.'));

export const verifyEmailSchema = signInSchema.extend({
  code: emailCode,
});

export const requestPasswordResetSchema = z.object({ email });
export const resetPasswordSchema = z.object({ email, code: emailCode, newPassword: z.string().min(10).max(128) });

export const googleRoleSchema = z.object({role: registrationRole}).strict();
export const googleCompletionSchema = googleRoleSchema.extend({
  fullName: publicName,
  phone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, "Enter a valid mobile number with country code.")
    .refine((value) => {
      const parsed = parsePhoneNumberFromString(value, {extract: false});
      return parsed?.isValid() && ["MOBILE", "FIXED_LINE_OR_MOBILE"].includes(parsed.getType() ?? "");
    }, "Enter a valid mobile number.").optional(),
});
export type GoogleCompletionInput = z.infer<typeof googleCompletionSchema>;

export const mobileSignupSchema = z.object({
  challengeId: z.string().uuid(),
  firstName: z.string().trim().min(1, "Enter your first name.").max(50),
  lastName: z.string().trim().max(49).default(""),
  email,
  password: z.string().min(10, "Use at least 10 characters.").max(128),
  confirmPassword: z.string().max(128),
  role: registrationRole,
}).strict().refine(({password, confirmPassword}) => password === confirmPassword, {
  path: ["confirmPassword"], message: "Passwords must match.",
});
export const mobileSignupEmailSchema = z.object({challengeId: z.string().uuid(), code: emailCode}).strict();
export type MobileSignupInput = z.infer<typeof mobileSignupSchema>;

export type RegisterInput = z.infer<typeof registerSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
