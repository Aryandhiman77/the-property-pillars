"use client";

import Link from "next/link";
import {useEffect, useState, type FormEvent} from "react";
import {safeLoginReturn} from "@the-property-pillar/contracts";
import {BrandLogo} from "@/components/layout/brand-logo";
import {isPublicTask, publicTasks} from "@/config/public-tasks";
import {getCollectionDescriptor} from "@/features/dashboard/collection-config";
import {roleConfigs} from "@/features/dashboard/role-config";
import {apiRequest} from "@/lib/api/client";
import {AuthAccess, type RegistrationRoleOption} from "./auth-access";
import {loginHref} from "./login-return";
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
  const [role, setRole] = useState<RegisterRole>(roles[0].role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function complete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<{next: string}>("/auth/google/complete", {method: "POST", body: {role}});
      window.location.replace(safeLoginReturn(result.next, locale));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not finish Google sign-in. Try again.");
      setBusy(false);
    }
  }
  return <main className={styles.oauthSetup}>
    <div className={styles.selectorHeader}>
      <Link className={styles.brand} href={`/${locale}`}><BrandLogo /></Link>
      <h1>Choose your account role</h1>
      <p>Finish setting up your Property Pillar account before continuing.</p>
    </div>
    <form className={styles.accountForm} aria-busy={busy} onSubmit={complete}>
      <label>
        <span>Primary role</span>
        <select value={role} onChange={(event) => setRole(event.target.value as RegisterRole)} disabled={busy}>
          {roles.map((option) => <option key={option.role} value={option.role}>{option.label}</option>)}
        </select>
      </label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.submitButton} disabled={busy} type="submit">{busy ? "Setting up account…" : "Create account and continue"}</button>
      <Link href={loginHref(locale, next)}>Back to sign in</Link>
    </form>
  </main>;
}

export function Login({locale, next, google}: {locale: string; next: string; google?: string}) {
  const auth = useSession();
  useEffect(() => {
    if (auth.session) window.location.replace(next);
  }, [auth.session, next]);
  const destination = new URL(next, "https://login-return.invalid");
  const taskPath = destination.pathname.split("/").slice(2).join("/");
  const allowed = isPublicTask(taskPath) ? getCollectionDescriptor(publicTasks[taskPath].collection).createRoles : userRoles;
  const roles = userRoles.filter((role): role is RegisterRole => role !== "ADMIN" && allowed.includes(role)).map((role) => ({
    role, label: roleConfigs[role].label, description: roleConfigs[role].description, icon: roleConfigs[role].icon,
  }));
  if (google === "setup") return <GoogleSetup locale={locale} next={next} roles={roles} />;
  const listingIntent = taskPath === "post-property" || (taskPath === "dashboard" && destination.searchParams.get("create") === "property");
  return <AuthAccess roles={roles} listingIntent={listingIntent} accountBusy={auth.accountBusy || auth.state === "loading" || !!auth.session} error={auth.error}
    googleHref={"/api/v1/auth/google/start?" + new URLSearchParams({locale, next})}
    providerMessage={google && Object.hasOwn(providerMessages, google) ? providerMessages[google] : undefined}
    onClearError={auth.clearError} onSignIn={auth.signIn} onRegister={auth.register}
    onVerifyEmail={auth.verifyEmail} onResendVerification={auth.resendVerification} />;
}
