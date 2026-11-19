import type {Request, RequestHandler} from "express";
import {safeLoginReturn} from "@the-property-pillar/contracts";
import {env} from "../config/env.js";
import {sendSuccess} from "../helpers/api-response.js";
import type {GoogleRoleInput} from "../schemas/auth.schema.js";
import {completeGoogleSignIn, exchangeGoogleCode, googleLoginPage, googleOAuthConfig, readGoogleChallenge, startGoogleSignIn} from "../services/google-auth.service.js";
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";
import {replaceBrowserSession} from "./auth.controller.js";
import {getSessionCookie} from "../helpers/session-cookie.js";

const challengeCookie = "tpp_google_challenge";
const onboardingCookie = "tpp_google_onboarding";
const cookieOptions = {httpOnly: true, sameSite: "lax" as const, secure: env.NODE_ENV === "production", path: "/api/v1/auth/google"};
const maxAge = 10 * 60_000;

function readCookie(request: Request, name: string) {
  const value: unknown = request.cookies?.[name];
  return typeof value === "string" ? value : undefined;
}

export const beginGoogle: RequestHandler = asyncHandler(async (request, response) => {
  response.setHeader("Referrer-Policy", "no-referrer");
  const next = safeLoginReturn(request.query.next, typeof request.query.locale === "string" ? request.query.locale : undefined);
  const config = googleOAuthConfig();
  if (!config) { response.redirect(303, googleLoginPage(next, "unavailable")); return; }
  const start = await startGoogleSignIn(next, config);
  response.clearCookie(onboardingCookie, cookieOptions);
  response.cookie(challengeCookie, start.cookie, {...cookieOptions, maxAge});
  response.redirect(303, start.url);
});

export const finishGoogle: RequestHandler = asyncHandler(async (request, response) => {
  response.setHeader("Referrer-Policy", "no-referrer");
  const challenge = await readGoogleChallenge(readCookie(request, challengeCookie));
  response.clearCookie(challengeCookie, cookieOptions);
  const next = safeLoginReturn(challenge?.next);
  const config = googleOAuthConfig();
  if (!challenge || request.query.state !== challenge.state || !config) {
    response.redirect(303, googleLoginPage(next, "failed"));
    return;
  }
  const {code, error} = request.query;
  if (error || typeof code !== "string" || code.length === 0 || code.length > 4096) {
    response.redirect(303, googleLoginPage(next, error === "access_denied" ? "cancelled" : "failed"));
    return;
  }
  try {
    const result = await exchangeGoogleCode(code, challenge, config);
    if (result.session) {
      await replaceBrowserSession(getSessionCookie(request), response, result.session);
      response.redirect(303, next);
      return;
    }
    response.cookie(onboardingCookie, result.onboarding, {...cookieOptions, maxAge});
    response.redirect(303, googleLoginPage(next, "setup"));
  } catch (error) {
    response.redirect(303, googleLoginPage(next, error instanceof ApiError && error.code === "GOOGLE_USE_EMAIL" ? "use-email" : "failed"));
  }
});

export const createGoogleAccount: RequestHandler = asyncHandler(async (request, response) => {
  const result = await completeGoogleSignIn(readCookie(request, onboardingCookie), (request.body as GoogleRoleInput).role);
  await replaceBrowserSession(getSessionCookie(request), response, result.session);
  response.clearCookie(onboardingCookie, cookieOptions);
  sendSuccess(response, {next: result.next}, 201);
});
