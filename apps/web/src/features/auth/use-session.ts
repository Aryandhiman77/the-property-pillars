"use client";

import {useCallback, useEffect, useState} from "react";

import {ApiClientError, apiRequest} from "@/lib/api/client";
import type {AuthSession, RegistrationInput, SignInInput} from "./types";

type SessionState = "loading" | "guest" | "authenticated" | "error";

export type AuthError = {
  message: string;
  fieldErrors: Record<string, string>;
};

function normalizeError(error: unknown): AuthError {
  if (error instanceof ApiClientError) {
    return {
      message: error.message,
      fieldErrors: error.code === "EMAIL_ALREADY_REGISTERED" ? {email: error.message}
        : error.code === "INVALID_CREDENTIALS" ? {password: error.message} : error.fieldErrors,
    };
  }

  return {
    message: "The workspace could not be reached. Check your connection and try again.",
    fieldErrors: {},
  };
}

export function useSession() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [state, setState] = useState<SessionState>("loading");
  const [error, setError] = useState<AuthError | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);

  const clearError = useCallback(() => setError(null), []);

  const updateIdentity = useCallback(({fullName, logoUrl}: {fullName: string; logoUrl: string | null}) => {
    setSession((current) => current ? {...current, name: fullName, logoUrl} : current);
  }, []);

  const refresh = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const nextSession = await apiRequest<AuthSession>("/auth/session");
      setSession(nextSession);
      setState("authenticated");
    } catch (requestError) {
      setSession(null);

      if (requestError instanceof ApiClientError && requestError.status === 401) {
        setState("guest");
        return;
      }

      setError(normalizeError(requestError));
      setState("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async (input: SignInInput) => {
    setAccountBusy(true);
    setError(null);

    try {
      const nextSession = await apiRequest<AuthSession>("/auth/sign-in", {
        method: "POST",
        body: input,
      });
      setSession(nextSession);
      setState("authenticated");
    } catch (requestError) {
      setSession(null);
      setError(normalizeError(requestError));
      setState("guest");
      throw requestError;
    } finally {
      setAccountBusy(false);
    }
  }, []);

  const submitRegistration = useCallback(async (
    path: "/auth/register" | "/account/email/verify" | "/account/email/code",
    input: RegistrationInput | {code: string} | undefined,
  ) => {
    setAccountBusy(true);
    setError(null);

    try {
      await apiRequest(path, {
        method: "POST",
        body: input,
      });
    } catch (requestError) {
      setError(normalizeError(requestError));
      throw requestError;
    } finally {
      setAccountBusy(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setAccountBusy(true);
    setError(null);

    try {
      await apiRequest<{loggedOut: boolean}>("/auth/logout", {method: "POST"});
      setSession(null);
      setState("guest");
    } catch (requestError) {
      setError(normalizeError(requestError));
    } finally {
      setAccountBusy(false);
    }
  }, []);

  return {
    accountBusy,
    clearError,
    error,
    logout,
    refresh,
    updateIdentity,
    register: (input: RegistrationInput) => submitRegistration("/auth/register", input),
    verifyEmail: (input: {code: string}) => submitRegistration("/account/email/verify", input),
    resendVerification: () => submitRegistration("/account/email/code", undefined),
    session,
    signIn,
    state,
  };
}
