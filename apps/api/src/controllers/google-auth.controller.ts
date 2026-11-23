import type {Request, RequestHandler} from "express";
import {safeLoginReturn} from "@the-property-pillar/contracts";
import {env} from "../config/env.js";
import {sendSuccess} from "../helpers/api-response.js";
import type {GoogleCompletionInput} from "../schemas/auth.schema.js";
import {completeGoogleSignIn, exchangeGoogleCode, googleLoginPage, googleOAuthConfig, readGoogleChallenge, readGoogleOnboarding, startGoogleSignIn} from "../services/google-auth.service.js";
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";
import {replaceBrowserSession} from "./auth.controller.js";
import {getSessionCookie} from "../helpers/session-cookie.js";

const challengeCookie = "tpp_google_challenge";
const onboardingCookie = "tpp_google_onboarding";
const cookieOptions = {httpOnly: true, sameSite: "lax" as const, secure: env.NODE_ENV === "production", path: "/api/v1/auth/google"};
const maxAge = 10 * 60_000;
const localHostnames = new Set(["localhost", "127.0.0.1", "[::1]"]);

function readCookie(request: Request, name: string) {
  const value: unknown = request.cookies?.[name];
  return typeof value === "string" ? value : undefined;
}

export const beginGoogle: RequestHandler = asyncHandler(async (request, response) => {
  response.setHeader("Referrer-Policy", "no-referrer");
  const next = safeLoginReturn(request.query.next, typeof request.query.locale === "string" ? request.query.locale : undefined);
  const config = googleOAuthConfig();
  if (!config) { response.redirect(303, googleLoginPage(next, "unavailable")); return; }
  if (env.NODE_ENV === "development") {
    const callback = new URL(config.redirectUri);
    const requestHost = request.get("x-forwarded-host") ?? request.get("host");
    const current = URL.parse("http://" + requestHost);
    // The callback can only read the challenge cookie on the host that set it.
    if (current && localHostnames.has(current.hostname) && localHostnames.has(callback.hostname) && current.host !== callback.host) {
      const startUrl = new URL("/api/v1/auth/google/start", callback);
      startUrl.searchParams.set("next", next);
      response.redirect(303, startUrl.toString());
      return;
    }
  }
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

export const getGoogleOnboarding: RequestHandler = asyncHandler(async (request, response) => {
  const {name, email, phone, role} = await readGoogleOnboarding(readCookie(request, onboardingCookie));
  sendSuccess(response, {fullName: name, email, phone, role});
});

export const createGoogleAccount: RequestHandler = asyncHandler(async (request, response) => {
  const result = await completeGoogleSignIn(readCookie(request, onboardingCookie), request.body as GoogleCompletionInput);
  await replaceBrowserSession(getSessionCookie(request), response, result.session);
  response.clearCookie(onboardingCookie, cookieOptions);
  sendSuccess(response, {next: result.next}, 201);
});
