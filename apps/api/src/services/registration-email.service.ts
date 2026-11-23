import { createHash, randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';

import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

const VALIDITY_MINUTES = 15;
export const verificationLifetimeMs = VALIDITY_MINUTES * 60_000;
export const verificationResendDelayMs = 60_000;

const from = env.SMTP_FROM ?? env.SMTP_USER;
const transport = env.SMTP_HOST && from && Boolean(env.SMTP_USER) === Boolean(env.SMTP_PASSWORD)
  ? nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    requireTLS: env.NODE_ENV === 'production' && env.SMTP_PORT !== 465,
    ...(env.SMTP_USER && env.SMTP_PASSWORD ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } } : {}),
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
  })
  : null;

export function requireRegistrationEmail() {
  if (!transport || !from) {
    throw new ApiError(503, 'EMAIL_DELIVERY_UNAVAILABLE', 'Account email is temporarily unavailable. Please try again later.');
  }
  return { transport, from };
}

export function configuredSmtp() {
  return transport && from ? {transport, from} : null;
}

export function hashVerificationCode(code: string) {
  return createHash('sha256').update(code).digest('hex');
}

export function newEmailCode() {
  const code = randomBytes(8).toString('hex').toUpperCase();
  return { code, hash: hashVerificationCode(code), expiresAt: new Date(Date.now() + verificationLifetimeMs) };
}

export function newVerificationCode() {
  const { code, hash, expiresAt } = newEmailCode();
  return {
    code,
    data: {
      emailVerificationCodeHash: hash,
      emailVerificationExpiresAt: expiresAt,
    },
  };
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  const { transport, from } = requireRegistrationEmail();
  await transport.sendMail({
    from,
    to,
    subject: 'Reset your Property Pillar password',
    text: `Enter this code on the Property Pillar password reset screen.\n\n${code.match(/.{4}/g)?.join('-')}\n\nIt expires in ${VALIDITY_MINUTES} minutes. If you did not ask to reset your password, you can ignore this email.`,
  });
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  const { transport, from } = requireRegistrationEmail();
  try {
    await transport.sendMail({
      from,
      to,
      subject: 'Verify your Property Pillar email',
      text: `Enter this code on the Property Pillar registration screen.\n\n${code.match(/.{4}/g)?.join('-')}\n\nIt expires in ${VALIDITY_MINUTES} minutes. If you did not request this code, you can ignore this email.`,
    });
  } catch {
    throw new ApiError(503, 'EMAIL_DELIVERY_FAILED', 'The verification email could not be sent. Use Resend code to try again.');
  }
}
