import {timingSafeEqual} from "node:crypto";
import {Prisma, type MobileChallenge} from "@prisma/client";
import {z} from "zod";
import {prisma} from "../database/prisma.js";
import type {MobileSignupInput} from "../schemas/auth.schema.js";
import {ApiError} from "../utils/api-error.js";

import {hashVerificationCode, newEmailCode, requireRegistrationEmail, sendVerificationEmail, verificationResendDelayMs} from "./registration-email.service.js";

const draft = z.object({
  fullName: z.string(), email: z.string(),
  role: z.enum(["BUYER", "OWNER", "DEALER", "BUILDER", "VENDOR", "PROFESSIONAL", "WHITE_COLLAR_SEEKER", "BLUE_COLLAR_WORKER"]),
  codeHash: z.string().regex(/^[a-f0-9]{64}$/), sentAt: z.number(), expiresAt: z.number(),
});
const emailProof = draft.pick({codeHash: true, sentAt: true, expiresAt: true});
const link = z.object({
  kind: z.literal("mobile-link"), userId: z.string(), email: z.string(), proof: emailProof.optional(),
});
const signup = z.object({kind: z.literal("mobile-signup"), userId: z.string().optional(), draft: draft.optional()});
type Signup = z.infer<typeof signup>;
export type MobileSignupProof = {challengeId: string; browserHash: string};

export function mobileSignupState(userId?: string): Signup {
  return {kind: "mobile-signup", ...(userId ? {userId} : {})};
}

const expired = () => new ApiError(401, "MOBILE_SIGNUP_EXPIRED", "Verify your mobile number again to continue.");
const emailInUse = () => new ApiError(409, "EMAIL_ALREADY_REGISTERED", "This email address is already in use.", {email: ["Use a different email address."]});

async function lockSignup(tx: Prisma.TransactionClient, proof: MobileSignupProof) {
  const [row] = await tx.$queryRaw<MobileChallenge[]>`SELECT * FROM "MobileChallenge" WHERE id = ${proof.challengeId} FOR UPDATE`;
  if (!row || row.browserHash !== proof.browserHash || !row.consumedAt || row.expiresAt <= new Date()) throw expired();
  const state = z.discriminatedUnion("kind",[signup,link]).safeParse(row.profile);
  if (!state.success) throw expired();
  return {row, state: state.data};
}

async function accountForLink(tx: Prisma.TransactionClient, row: MobileChallenge, state: z.infer<typeof link>) {
  const user = await tx.user.findFirst({
    where: {
      id: state.userId, tenantId: row.tenantId, phone: row.phone, phoneVerifiedAt: null,
      email: state.email, emailVerifiedAt: {not: null}, status: "ACTIVE", role: {not: "ADMIN"},
    },
    select: {id: true, updatedAt: true},
  });
  if (!user) throw expired();
  return user;
}

async function accountForProof(tx: Prisma.TransactionClient, row: MobileChallenge, state: Signup) {
  const account = await tx.user.findUnique({where: {phone: row.phone}});
  if ((account?.id ?? undefined) !== state.userId || (account &&
      (account.tenantId !== row.tenantId || account.status !== "ACTIVE" || account.role === "ADMIN" || !account.phoneVerifiedAt))) {
    throw expired();
  }
  return account;
}

function enforceResendDelay(saved?: {sentAt:number}) {
  if (saved && Date.now() - saved.sentAt < verificationResendDelayMs) {
    throw new ApiError(429, "EMAIL_VERIFICATION_COOLDOWN", "Wait one minute before sending another verification email.");
  }
}

export async function prepareMobileSignup(proof: MobileSignupProof, input: MobileSignupInput) {
  const email = input.email;
  if (!email) return prisma.$transaction(async tx => {
    const {row,state} = await lockSignup(tx,proof);
    if (state.kind !== "mobile-signup" || await accountForProof(tx,row,state)) throw expired();
    const user = await tx.user.create({data:{tenantId:row.tenantId,phone:row.phone,phoneVerifiedAt:new Date(),status:"ACTIVE",
      role:input.role,fullName:[input.firstName,input.lastName].filter(Boolean).join(" ")},select:{id:true,tenantId:true,role:true}});
    await tx.mobileChallenge.update({where:{id:row.id},data:{profile:Prisma.DbNull}});
    return {...user,phone:row.phone};
  });
  requireRegistrationEmail();
  const code = newEmailCode();
  await prisma.$transaction(async (tx) => {
    const {row, state} = await lockSignup(tx, proof);
    if (state.kind !== "mobile-signup") throw expired();
    const account = await accountForProof(tx, row, state);
    if (account && input.role !== account.role) {
      throw new ApiError(422, "MOBILE_ROLE_IMMUTABLE", "Choose the role associated with this mobile number.", {role: ["Your existing account role must be kept."]});
    }
    if (account?.email && account.email !== input.email) {
      throw new ApiError(422, "MOBILE_EMAIL_IMMUTABLE", "Complete verification with the email on your account.", {email: ["Use the email already associated with your account."]});
    }
    const emailAccount = await tx.user.findUnique({where: {email: input.email}, select: {id: true}});
    if (emailAccount && emailAccount.id !== account?.id) throw emailInUse();
    enforceResendDelay(state.draft);
    await tx.mobileChallenge.update({where: {id: row.id}, data: {attempts: 0, profile: {
      ...state, draft: {fullName: [input.firstName, input.lastName].filter(Boolean).join(" "), email: email,
        role: input.role, codeHash: code.hash, sentAt: Date.now(), expiresAt: code.expiresAt.valueOf()},
    }}});
  });
  await sendVerificationEmail(email, code.code);
  return null;
}

export async function resendMobileSignup(proof: MobileSignupProof) {
  requireRegistrationEmail();
  const code = newEmailCode();
  const email = await prisma.$transaction(async (tx) => {
    const {row, state} = await lockSignup(tx, proof);
    if (state.kind === "mobile-link") {
      await accountForLink(tx, row, state);
      enforceResendDelay(state.proof);
      await tx.mobileChallenge.update({
        where: {id: row.id},
        data: {attempts: 0, profile: {
          ...state, proof: {codeHash: code.hash, sentAt: Date.now(), expiresAt: code.expiresAt.valueOf()},
        }},
      });
      return state.email;
    }
    if (!state.draft) throw expired();
    enforceResendDelay(state.draft);
    await tx.mobileChallenge.update({where: {id: row.id}, data: {attempts: 0, profile: {
      ...state, draft: {...state.draft, codeHash: code.hash, sentAt: Date.now(), expiresAt: code.expiresAt.valueOf()},
    }}});
    return state.draft.email;
  });
  await sendVerificationEmail(email, code.code);
}

export async function finishMobileSignup(proof: MobileSignupProof, code: string) {
  const account = await prisma.$transaction(async (tx) => {
    const {row, state} = await lockSignup(tx, proof);
    const saved = state.kind === "mobile-link" ? state.proof : state.draft;
    if (!saved || row.attempts >= 5 || saved.expiresAt <= Date.now()) return null;
    if (!timingSafeEqual(Buffer.from(saved.codeHash, "hex"), Buffer.from(hashVerificationCode(code), "hex"))) {
      await tx.mobileChallenge.update({where: {id: row.id}, data: {attempts: {increment: 1}}});
      return null;
    }
    if (state.kind === "mobile-link") {
      const account = await accountForLink(tx, row, state);
      const member = await tx.user.update({
        where: {id: account.id, updatedAt: account.updatedAt},
        data: {phoneVerifiedAt: new Date()},
        select: {id: true, role: true, tenantId: true},
      });
      await tx.mobileChallenge.update({where: {id: row.id}, data: {profile: Prisma.DbNull}});
      return {...member, phone: row.phone};
    }
    if (!state.draft) throw expired();
    const existing = await accountForProof(tx, row, state);
    if (existing?.email && existing.email !== state.draft.email) throw expired();
    const {fullName, email, role} = state.draft;
    const data = {fullName, email, status:"ACTIVE" as const, emailVerifiedAt: new Date()};
    const select = {id: true, role: true, tenantId: true};
    const member = existing
      ? await tx.user.update({where: {id: existing.id, updatedAt: existing.updatedAt}, data, select})
      : await tx.user.create({data: {...data, role: role, tenantId: row.tenantId, phone: row.phone, phoneVerifiedAt: new Date()}, select});
    await tx.mobileChallenge.update({where: {id: row.id}, data: {profile: Prisma.DbNull}});
    return {...member, phone: row.phone};
  }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002" && Array.isArray(error.meta?.target) && error.meta.target.includes("email")) throw emailInUse();
      if (["P2002", "P2025"].includes(error.code)) throw expired();
    }
    throw error;
  });
  if (!account) throw new ApiError(422, "EMAIL_VERIFICATION_CODE_INVALID", "The email code is invalid or expired.", {code: ["Enter the latest code or request a new one."]});
  return account;
}
