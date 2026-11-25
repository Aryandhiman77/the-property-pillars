import {createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual} from "node:crypto";
import {leadVisitorTypes} from "@the-property-pillar/contracts";
import {Prisma} from "@prisma/client";
import {ipKeyGenerator} from "express-rate-limit";
import type {RequestHandler} from "express";
import {parsePhoneNumberFromString} from "libphonenumber-js/max";
import {z} from "zod";
import {env} from "../config/env.js";
import {prisma} from "../database/prisma.js";
import {getOrCreateMarketplaceTenant} from "../database/tenant.js";
import {sendSuccess} from "../helpers/api-response.js";
import {parseInput} from "../helpers/parse-input.js";
import {getSessionCookie} from "../helpers/session-cookie.js";
import {authService} from "../services/auth.service.js";
import {setLeadIdentity} from "../services/lead-identity.js";
import {sendMobileCode} from "../services/mobile-sms.service.js";
import {sessionService} from "../services/session.service.js";
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";
import {replaceBrowserSession} from "./auth.controller.js";
import {mobileSignupEmailSchema, mobileSignupSchema} from "../schemas/auth.schema.js";
import {mobileSignupState, prepareMobileSignup, resendMobileSignup, finishMobileSignup, type MobileSignupProof} from "../services/mobile-signup.service.js";

const browserCookie = "tpp_mobile_challenge";
const cookieOptions = {httpOnly: true, sameSite: "lax" as const, secure: env.NODE_ENV === "production", path: "/api/v1/auth/mobile", maxAge: 60 * 60_000};
const ttl = 5 * 60_000;
const hash = (purpose: string, value: string) => createHmac("sha256", env.JWT_SECRET).update(purpose + ":" + value).digest("hex");
const roleChoice = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(100),
  visitorType: z.enum(leadVisitorTypes, {required_error: "Choose an option."}),
  scope: z.string().regex(/^(?:property:[a-z0-9_-]+|map:[a-z0-9_-]+|workspace:(?:propertyInquiries|loanInquiries|materialRfqs|serviceInquiries)|like:[a-z0-9_-]+)$/i).max(150),
});
const profileInput = z.object({profileUserId: z.string()});
const startInput = z.object({
  phone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, "Enter a valid mobile number with country code."),
  registration: roleChoice.optional(),
  profile: z.boolean().optional(),
}).strict();

function signupProof(req: Parameters<RequestHandler>[0], challengeId: string): MobileSignupProof {
  const browser: unknown = req.cookies?.[browserCookie];
  if (req.session || typeof browser !== "string" || !/^[a-f0-9]{64}$/i.test(browser)) {
    throw new ApiError(401, "MOBILE_SIGNUP_EXPIRED", "Verify your mobile number again to continue.");
  }
  return {challengeId, browserHash: hash("mobile-browser", browser)};
}

export const startMobile: RequestHandler = asyncHandler(async (req, res) => {
  const {phone, registration, profile} = parseInput(startInput, req.body);
  if (profile && !req.session) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Sign in to update your mobile number.");
  if (req.session?.role === "ADMIN" || (req.session && !profile)) throw new ApiError(403, "MOBILE_ACTION_FORBIDDEN", "This mobile action is unavailable for the current account.");
  const parsed = parsePhoneNumberFromString(phone, {extract: false});
  if (!parsed?.isValid() || !["MOBILE", "FIXED_LINE_OR_MOBILE"].includes(parsed.getType() ?? "")) {
    throw new ApiError(422, "INVALID_MOBILE", "Enter a valid mobile number.", {phone: ["Enter a valid mobile number."]});
  }
  const mobile = parsed.number;
  const tenant = req.session ? {id: req.session.tenantId} : await getOrCreateMarketplaceTenant();
  const previousCookie: unknown = req.cookies?.[browserCookie];
  const browser = typeof previousCookie === "string" && /^[a-f0-9]{64}$/.test(previousCookie) ? previousCookie : randomBytes(32).toString("hex");
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const ipHash = hash("mobile-ip", ipKeyGenerator(ip.replace(/^::ffff:/i, "")));
  const id = randomUUID();
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttl);
  const details = profile ? {profileUserId: req.session!.userId} : registration;
  const where = {tenantId: tenant.id, phone: mobile};
  await prisma.$transaction(async (tx) => {
    for (const key of ["mobile-phone:" + mobile, "mobile-ip:" + ipHash]) {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    }
    const since = new Date(now.getTime() - 60 * 60_000);
    const [recent, ipCount] = await Promise.all([
      tx.mobileChallenge.findMany({where: {...where, createdAt: {gt: since}}, orderBy: {createdAt: "desc"}, take: 3}),
      tx.mobileChallenge.count({where: {tenantId: tenant.id, ipHash, createdAt: {gt: since}}}),
    ]);
    if (recent.length >= 3 || ipCount >= 12 || (recent[0] && now.getTime() - recent[0].createdAt.getTime() < 60_000)) {
      throw new ApiError(429, "OTP_COOLDOWN", "Please wait before requesting another code.");
    }
    await tx.mobileChallenge.updateMany({where: {...where, consumedAt: null}, data: {consumedAt: now}});
    await tx.mobileChallenge.create({data: {id, ...where, ipHash, browserHash: hash("mobile-browser", browser),
      codeHash: hash("mobile-code:" + id, code), expiresAt, ...(details ? {profile: details} : {})}});
  });
  const origin = req.get("origin") ?? req.get("referer") ?? "";
  const local = env.NODE_ENV === "development" && /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(origin) &&
    /^(?:127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(ip);
  try {if (!local) await sendMobileCode(mobile, code);}
  catch (error) {
    await prisma.mobileChallenge.updateMany({where: {id}, data: {consumedAt: new Date()}});
    throw error;
  }
  res.cookie(browserCookie, browser, cookieOptions);
  sendSuccess(res, {challengeId: id, expiresIn: ttl / 1000, ...(local ? {developmentCode: code} : {})});
});

export const verifyMobile: RequestHandler = asyncHandler(async (req, res) => {
  const {challengeId, code} = parseInput(z.object({challengeId: z.string().uuid(), code: z.string().trim().regex(/^\d{6}$/, "Enter the six-digit code.")}).strict(), req.body);
  const browser: unknown = req.cookies?.[browserCookie];
  const invalid = () => new ApiError(422, "INVALID_OTP", "The code is incorrect or expired.", {code: ["Enter the current verification code or request a new one."]});
  if (typeof browser !== "string" || browser.length !== 64) throw invalid();
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{id: string}[]>`SELECT id FROM "MobileChallenge" WHERE id = ${challengeId} FOR UPDATE`;
    if (!locked) return null;
    const row = await tx.mobileChallenge.findUniqueOrThrow({where: {id: challengeId}});
    if (row.browserHash !== hash("mobile-browser", browser) || row.consumedAt || row.expiresAt <= now || row.attempts >= 5) return null;
    if (!timingSafeEqual(Buffer.from(row.codeHash, "hex"), Buffer.from(hash("mobile-code:" + row.id, code), "hex"))) {
      await tx.mobileChallenge.update({where: {id: row.id}, data: {attempts: {increment: 1}}});
      return null;
    }
    const profile = profileInput.safeParse(row.profile);
    const intent = roleChoice.safeParse(row.profile);
    const existing = await tx.user.findUnique({where: {phone: row.phone}});
    if (profile.success) {
      if (req.session?.userId !== profile.data.profileUserId || req.session.tenantId !== row.tenantId) throw invalid();
      if (existing && existing.id !== req.session.userId) throw new ApiError(409, "PHONE_IN_USE", "This mobile number belongs to another account.", {phone: ["This number is already in use."]});
      await tx.user.update({where: {id: req.session.userId}, data: {phone: row.phone, phoneVerifiedAt: now, pendingRegistrationPhone: null}});
      await tx.mobileChallenge.update({where: {id: row.id}, data: {consumedAt: now}});
      return {updated: true} as const;
    }
    if (req.session) throw invalid();
    if (existing && (existing.tenantId !== row.tenantId || existing.status !== "ACTIVE" || existing.role === "ADMIN")) {
      throw new ApiError(409, "ACCOUNT_SIGN_IN_REQUIRED", "Sign in with your existing account and verify your mobile number from your profile.");
    }
    if (existing && !existing.phoneVerifiedAt) {
      // A saved contact number alone is not an account credential. Bind it once
      // using both the phone OTP and the account's previously verified mailbox.
      if (intent.success || !existing.email || !existing.emailVerifiedAt || (!existing.passwordHash && !existing.googleSubject)) {
        throw new ApiError(409, "ACCOUNT_SIGN_IN_REQUIRED", "Sign in using your existing method and verify the number from your profile.");
      }
      await tx.mobileChallenge.update({
        where: {id: row.id},
        data: {
          consumedAt: now, expiresAt: new Date(now.getTime() + 30 * 60_000), attempts: 0,
          profile: {kind: "mobile-link", userId: existing.id, email: existing.email},
        },
      });
      return {onboarding: {challengeId: row.id, phone: row.phone, confirmExistingEmail: true}};
    }
    if (!intent.success && (!existing || !existing.emailVerifiedAt || (!existing.passwordHash && !existing.googleSubject))) {
      await tx.mobileChallenge.updateMany({
        where: {id: {not: row.id}, tenantId: row.tenantId, phone: row.phone, profile: {path: ["kind"], equals: "mobile-signup"}},
        data: {profile: Prisma.DbNull},
      });
      await tx.mobileChallenge.update({
        where: {id: row.id},
        data: {consumedAt: new Date(), expiresAt: new Date(Date.now() + 30 * 60_000), attempts: 0,
          profile: mobileSignupState(existing?.id)},
      });
      return {onboarding: {challengeId: row.id, phone: row.phone, ...(existing ? {fullName: existing.fullName, email: existing.email, role: existing.role} : {})}};
    }
    const selection = intent.data?.visitorType;
    const role = selection === "MATERIALS_CUSTOMER" || selection === "OTHER" ? "BUYER" : selection;
    const user = existing ?? await tx.user.create({data: {tenantId: row.tenantId, fullName: intent.data!.fullName, phone: row.phone, phoneVerifiedAt: now, role: role!}});
    await tx.mobileChallenge.update({where: {id: row.id}, data: {consumedAt: now}});
    return {user, phone: row.phone, intent: intent.data};
  }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError(409, "PHONE_IN_USE", "This mobile number is already in use.");
    throw error;
  });
  if (!result) throw invalid();
  if ("updated" in result) {sendSuccess(res, {updated: true}); return;}
  if ("onboarding" in result) {sendSuccess(res, {onboarding: result.onboarding}); return;}
  const {user, phone, intent} = result;
  const issued = await sessionService.issue({userId: user.id, tenantId: user.tenantId, role: user.role, verifiedPhone: phone});
  if (intent?.scope) await setLeadIdentity(res, {scope: intent.scope, sessionId: issued.context.sessionId, fullName: intent.fullName, phone, visitorType: intent.visitorType});
  await replaceBrowserSession(getSessionCookie(req), res, issued);
  sendSuccess(res, authService.toPublicSession(issued.context));
});

export const completeMobile: RequestHandler = asyncHandler(async (req, res) => {
  const input = parseInput(mobileSignupSchema, req.body);
  await prepareMobileSignup(signupProof(req, input.challengeId), input);
  sendSuccess(res, {verificationRequired: true});
});

export const resendMobileEmail: RequestHandler = asyncHandler(async (req, res) => {
  const {challengeId} = parseInput(z.object({challengeId: z.string().uuid()}).strict(), req.body);
  await resendMobileSignup(signupProof(req, challengeId));
  sendSuccess(res, {sent: true});
});

export const verifyMobileEmail: RequestHandler = asyncHandler(async (req, res) => {
  const {challengeId, code} = parseInput(mobileSignupEmailSchema, req.body);
  const user = await finishMobileSignup(signupProof(req, challengeId), code);
  const issued = await sessionService.issue({userId: user.id, tenantId: user.tenantId, role: user.role, verifiedPhone: user.phone});
  await replaceBrowserSession(getSessionCookie(req), res, issued);
  sendSuccess(res, authService.toPublicSession(issued.context));
});
