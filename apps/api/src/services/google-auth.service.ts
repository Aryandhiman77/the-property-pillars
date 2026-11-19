import {createHash, createHmac, randomBytes} from "node:crypto";
import {Prisma} from "@prisma/client";
import {createRemoteJWKSet, EncryptJWT, jwtDecrypt, jwtVerify} from "jose";
import {z} from "zod";
import {safeLoginReturn} from "@the-property-pillar/contracts";
import {env} from "../config/env.js";
import {prisma} from "../database/prisma.js";
import {getOrCreateMarketplaceTenant} from "../database/tenant.js";
import type {AppRole} from "../types/auth.js";
import {ApiError} from "../utils/api-error.js";
import {sessionService} from "./session.service.js";

const keys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const audience = "the-property-pillar-google-flow";
const flowKey = createHmac("sha256", env.JWT_SECRET).update(audience).digest();
const token = () => randomBytes(32).toString("base64url");

const destination = {next: z.string().max(800)};
const challengeSchema = z.object({
  ...destination, stage: z.literal("challenge"), state: z.string(), nonce: z.string(), verifier: z.string(),
});
const identitySchema = z.object({
  sub: z.string().min(1).max(255),
  email: z.string().email().max(254).transform((value) => value.toLowerCase()),
  name: z.string().trim().max(250).optional(),
  hd: z.string().optional(),
  email_verified: z.literal(true),
});
const onboardingSchema = z.object({
  ...destination, stage: z.literal("onboarding"), subject: z.string().min(1), email: z.string().email(), name: z.string().min(2).max(100),
});
type Onboarding = z.infer<typeof onboardingSchema>;

export function googleOAuthConfig() {
  const {GOOGLE_OAUTH_CLIENT_ID: clientId, GOOGLE_OAUTH_CLIENT_SECRET: clientSecret, GOOGLE_OAUTH_REDIRECT_URI: redirectUri} = env;
  if (!clientId || !clientSecret || !redirectUri) return null;
  try {
    const redirect = new URL(redirectUri);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(redirect.hostname);
    if ((redirect.protocol !== "https:" && !(redirect.protocol === "http:" && loopback && env.NODE_ENV !== "production")) ||
        redirect.pathname !== "/api/v1/auth/google/callback" || redirect.username || redirect.password || redirect.search || redirect.hash) return null;
    return {clientId, clientSecret, redirectUri};
  } catch {
    return null;
  }
}

async function seal(payload: z.infer<typeof challengeSchema> | Onboarding) {
  return new EncryptJWT(payload).setProtectedHeader({alg: "dir", enc: "A256GCM"})
    .setIssuer(env.JWT_ISSUER).setAudience(audience).setIssuedAt().setExpirationTime("10m").encrypt(flowKey);
}

async function readFlow<T extends z.ZodType>(cookie: string | undefined, schema: T): Promise<z.infer<T> | null> {
  if (!cookie || cookie.length > 4096) return null;
  try {
    const {payload} = await jwtDecrypt(cookie, flowKey, {
      issuer: env.JWT_ISSUER, audience, keyManagementAlgorithms: ["dir"], contentEncryptionAlgorithms: ["A256GCM"],
      requiredClaims: ["exp", "iat"],
    });
    return schema.parse(payload);
  } catch {
    return null;
  }
}

export function googleLoginPage(next: string, result: string) {
  const locale = next.split("/")[1];
  return `/${locale}/login?${new URLSearchParams({next, google: result})}`;
}

export async function startGoogleSignIn(next: string, config: NonNullable<ReturnType<typeof googleOAuthConfig>>) {
  const state = token(), nonce = token(), verifier = token();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code",
    scope: "openid email profile", state, nonce, prompt: "select_account",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256",
  }).toString();
  return {url: url.href, cookie: await seal({stage: "challenge", next, state, nonce, verifier})};
}

export async function readGoogleChallenge(cookie: string | undefined) {
  return readFlow(cookie, challengeSchema);
}

function googleAccountUnavailable() {
  return new ApiError(409, "GOOGLE_USE_EMAIL", "Use email sign-in for this account.");
}

async function issueGoogleSession(user: {id: string; tenantId: string; role: AppRole; status: string; googleSubject: string | null; tenant: {isDemo: boolean}}) {
  if (user.role === "ADMIN" || user.status !== "ACTIVE" || user.tenant.isDemo || !user.googleSubject) throw googleAccountUnavailable();
  return sessionService.issue({userId: user.id, tenantId: user.tenantId, role: user.role, googleSubject: user.googleSubject});
}

export async function exchangeGoogleCode(code: string, challenge: z.infer<typeof challengeSchema>, config: NonNullable<ReturnType<typeof googleOAuthConfig>>) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      code, code_verifier: challenge.verifier, grant_type: "authorization_code",
      client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri,
    }),
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Google rejected the authorization code");
  const {id_token} = z.object({id_token: z.string().min(1)}).parse(await response.json());
  const {payload} = await jwtVerify(id_token, keys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"], audience: config.clientId,
    algorithms: ["RS256"], requiredClaims: ["exp", "iat", "sub", "nonce"], maxTokenAge: "10m",
  });
  if (payload.nonce !== challenge.nonce || (payload.azp !== undefined && payload.azp !== config.clientId)) {
    throw new Error("Google ID token did not match the browser request");
  }
  const identity = identitySchema.parse(payload);
  const {sub: subject, email, name, hd} = identity;
  const include = {tenant: {select: {isDemo: true}}} as const;
  const linked = await prisma.user.findUnique({where: {googleSubject: subject}, include});
  if (linked) return {session: await issueGoogleSession(linked)};

  // Gmail and Workspace can establish current ownership of the returned address.
  if (!email.endsWith("@gmail.com") && !hd) throw googleAccountUnavailable();
  const existing = await prisma.user.findUnique({where: {email}, include});
  if (existing) {
    if (!existing.emailVerifiedAt || existing.status !== "ACTIVE" || existing.role === "ADMIN" || existing.tenant.isDemo ||
        (existing.googleSubject && existing.googleSubject !== subject)) throw googleAccountUnavailable();
    const changed = await prisma.user.updateMany({
      where: {id: existing.id, email, status: "ACTIVE", role: {not: "ADMIN"}, emailVerifiedAt: {not: null},
        OR: [{googleSubject: null}, {googleSubject: subject}]},
      data: {googleSubject: subject},
    });
    if (!changed.count) throw googleAccountUnavailable();
    return {session: await issueGoogleSession({...existing, googleSubject: subject})};
  }
  return {onboarding: await seal({stage: "onboarding", next: safeLoginReturn(challenge.next), subject, email,
    name: (name && name.length >= 2 ? name : "Property Pillar member").slice(0, 100)})};
}

export async function completeGoogleSignIn(cookie: string | undefined, role: Exclude<AppRole, "ADMIN">) {
  const onboarding = await readFlow(cookie, onboardingSchema);
  if (!onboarding) throw new ApiError(400, "GOOGLE_FLOW_EXPIRED", "Google sign-in expired. Start again from the login page.");
  const include = {tenant: {select: {isDemo: true}}} as const;
  const tenant = await getOrCreateMarketplaceTenant();
  let user;
  try {
    user = await prisma.user.create({
      data: {tenantId: tenant.id, role, status: "ACTIVE", emailVerifiedAt: new Date(),
        email: onboarding.email, fullName: onboarding.name, googleSubject: onboarding.subject},
      include,
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    user = await prisma.user.findUnique({where: {googleSubject: onboarding.subject}, include});
    if (!user) throw googleAccountUnavailable();
  }
  return {session: await issueGoogleSession(user), next: safeLoginReturn(onboarding.next)};
}
