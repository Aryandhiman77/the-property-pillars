import {createHmac} from "node:crypto";
import type {Request, RequestHandler, Response} from "express";
import {SignJWT, jwtVerify} from "jose";
import {leadVisitorTypes} from "@the-property-pillar/contracts";
import {z} from "zod";
import {asyncHandler} from "../utils/async-handler.js";
import {ApiError} from "../utils/api-error.js";
import {env} from "../config/env.js";

const cookie = "tpp_lead_identity";
const key = createHmac("sha256", env.JWT_SECRET).update("lead-continuation-v1").digest();
const proof = z.object({requestId: z.string().uuid().optional(), userId: z.string().optional(), tenantId: z.string().optional(), scope: z.string(), sessionId: z.string(), visitorType: z.enum(leadVisitorTypes), fullName: z.string(), phone: z.string()});
type LeadIdentity = z.infer<typeof proof>;

export async function setLeadIdentity(res: Response, identity: LeadIdentity) {
  const token = await new SignJWT(identity).setProtectedHeader({alg: "HS256"}).setExpirationTime("20m").sign(key);
  res.cookie(cookie, token, {httpOnly: true, sameSite: "lax", secure: env.NODE_ENV === "production", path: "/api/v1", maxAge: 20 * 60_000});
}

export async function readLeadIdentity(req: Request, scope: string) {
  const token: unknown = req.cookies?.[cookie];
  if (typeof token !== "string") return null;
  const jwt = await jwtVerify(token, key, {algorithms: ["HS256"]}).catch(() => null);
  const parsed = proof.safeParse(jwt?.payload);
  return parsed.success && parsed.data.scope === scope && (req.session ? parsed.data.sessionId === req.session.sessionId : Boolean(parsed.data.userId && parsed.data.tenantId)) ? parsed.data : null;
}

// Install a guest identity only on the exact enquiry POST that was verified.
export function enquiryAccess(scopeFor: (req: Request) => string): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    if (!req.session) {
      const identity = await readLeadIdentity(req, scopeFor(req));
      if (!identity?.userId || !identity.tenantId || !identity.requestId || identity.requestId !== req.body?.requestId) throw new ApiError(401, "OTP_REQUIRED", "Verify your mobile number to send this enquiry.");
      req.session = {userId: identity.userId, tenantId: identity.tenantId, role: "BUYER", name: identity.fullName, sessionId: identity.sessionId};
    }
    next();
  });
}
