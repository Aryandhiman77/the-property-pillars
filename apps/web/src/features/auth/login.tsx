"use client";

import {useEffect, useState} from "react";
import {safeLoginReturn} from "@the-property-pillar/contracts";
import {isPublicTask, publicTasks} from "@/config/public-tasks";
import {getCollectionDescriptor} from "@/features/dashboard/collection-config";
import {roleConfigs} from "@/features/dashboard/role-config";
import {apiRequest} from "@/lib/api/client";
import {AuthAccess, type RegistrationRoleOption} from "./auth-access";
import {loginHref} from "./login-return";
import {AccountCompletionDialog, type GoogleOnboarding} from "./account-completion-dialog";
import {userRoles, type RegisterRole} from "./types";
import {useSession} from "./use-session";
import styles from "./auth-access.module.css";

const providerMessages: Record<string, string> = {
  unavailable: "Google sign-in is currently unavailable. You can sign in with email.",
  cancelled: "Google sign-in was cancelled. You can retry or sign in with email.",
  failed: "Google sign-in could not be completed. Try again or sign in with email.",
  "use-email": "Use email sign-in or registration for this account.",
};

function GoogleSetup({locale, next, roles}: {locale: string; next: string; roles: RegistrationRoleOption[]}) {
  const [details, setDetails] = useState<GoogleOnboarding>();
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    void apiRequest<GoogleOnboarding>("/auth/google/onboarding", {signal: abort.signal}).then((info) => {
      if (!abort.signal.aborted) setDetails(info);
    }, (failure) => {
      if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not read your Google profile.");
    });
    return () => abort.abort();
  }, []);
  if (details) return <AccountCompletionDialog info={details} roles={roles}
    onDismiss={() => window.location.replace(loginHref(locale, next))}
    finish={(destination) => window.location.replace(safeLoginReturn(destination ?? next, locale))}
    restart={() => window.location.assign("/api/v1/auth/google/start?" + new URLSearchParams({locale, next}))} />;
  return <div className={styles.oauthStatus} role={error ? "alert" : "status"}>
    {error || "Loading your Google details…"} {error && <a href={loginHref(locale, next)}>Back to sign in</a>}
  </div>;
}

export function Login({locale, next, google}: {locale: string; next: string; google?: string}) {
  const auth = useSession();
  useEffect(() => {
    if (auth.session) window.location.replace(next);
  }, [auth.session, next]);
  const destination = new URL(next, "https://login-return.invalid");
  const taskPath = destination.pathname.split("/").slice(2).join("/");
  const allowed = isPublicTask(taskPath) ? getCollectionDescriptor(publicTasks[taskPath].collection).createRoles : userRoles;
  const roles = userRoles.filter((role): role is RegisterRole => role !== "ADMIN" && allowed.some(value => value === role)).map((role) => ({
    role, label: roleConfigs[role].label, description: roleConfigs[role].description, icon: roleConfigs[role].icon,
  }));
  const listingIntent = taskPath === "post-property" || (taskPath === "dashboard" && destination.searchParams.get("create") === "property");
  return <><AuthAccess roles={roles} listingIntent={listingIntent} accountBusy={auth.accountBusy || auth.state === "loading" || !!auth.session} error={auth.error}
    onRegistrationComplete={() => window.location.replace(next)}
    googleHref={"/api/v1/auth/google/start?" + new URLSearchParams({locale, next})}
    providerMessage={google && Object.hasOwn(providerMessages, google) ? providerMessages[google] : undefined}
    onClearError={auth.clearError} onSignIn={auth.signIn} onRegister={auth.register}
    onVerifyEmail={auth.verifyEmail} onResendVerification={auth.resendVerification} />
    {google === "setup" && <GoogleSetup locale={locale} next={next} roles={roles} />}
  </>;
}
