"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import {useLocale} from "next-intl";
import {useEffect, useId, useRef, useState} from "react";
import type {LucideIcon} from "lucide-react";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  UserPlus,
} from "lucide-react";
import {BrandLogo} from "@/components/layout/brand-logo";
import {marketplaceArtwork} from "@/config/marketplace";
import {ApiClientError} from "@/lib/api/client";
import {focusInvalidControl} from "@/lib/form-validation";

import type {AccountCredentials, EmailVerificationInput, RegisterRole, RegistrationInput} from "./types";
import type {AuthError} from "./use-session";
import styles from "./auth-access.module.css";

const CountryCallingCode = dynamic(() => import("./country-calling-code").then((module) => module.CountryCallingCode), {
  loading: () => <span className={styles.countryTrigger} aria-hidden="true">+91</span>,
});

export type RegistrationRoleOption = {
  role: RegisterRole;
  label: string;
  description: string;
  icon: LucideIcon;
};

type AuthAccessProps = {
  roles: RegistrationRoleOption[];
  listingIntent?: boolean;
  googleHref?: string;
  providerMessage?: string;
  accountBusy: boolean;
  error: AuthError | null;
  onClearError: () => void;
  onSignIn: (input: AccountCredentials) => Promise<void>;
  onRegister: (input: RegistrationInput) => Promise<void>;
  onVerifyEmail: (input: EmailVerificationInput) => Promise<void>;
  onResendVerification: (input: AccountCredentials) => Promise<void>;
};

type AuthMode = "sign-in" | "register" | "verify-email";
type AccountField = "fullName" | "email" | "password" | "role" | "mobileCountry" | "mobileNumber" | "code";

function FieldError({id, message}: {id: string; message?: string}) {
  return message ? <small className={styles.fieldError} id={id} role="alert">{message}</small> : null;
}

export function AuthAccess({roles, listingIntent, googleHref, providerMessage, accountBusy, error, onClearError, onSignIn, onRegister, onVerifyEmail, onResendVerification}: AuthAccessProps) {
  const locale = useLocale();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobileCountry, setMobileCountry] = useState("IN");
  const [mobileNumber, setMobileNumber] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [role, setRole] = useState<RegisterRole>(listingIntent ? "OWNER" : roles[0]?.role ?? "BUYER");
  const [validationErrors, setValidationErrors] = useState<Partial<Record<AccountField, string>>>({});
  const [clearedErrors, setClearedErrors] = useState<Record<string, true>>({});
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (error && Object.keys(error.fieldErrors).length) focusInvalidControl(formRef.current);
  }, [error]);

  const isRegistering = mode === "register";
  const isVerifying = mode === "verify-email";
  const activeFields = isVerifying ? ["code"] : isRegistering
    ? ["fullName", "email", "password", "role", "mobileCountry", "mobileNumber"]
    : ["email", "password"];
  const serverFields = Object.keys(error?.fieldErrors ?? {});
  const formError = error && (!serverFields.length || serverFields.some((field) => !activeFields.includes(field))) ? error.message : null;
  const fieldErrors = Object.fromEntries(
    Object.entries({...error?.fieldErrors, ...validationErrors}).filter(([field]) => !clearedErrors[field]),
  );
  const selectedRole = roles.find((option) => option.role === role);
  const SelectedRoleIcon = selectedRole?.icon;

  function clearFieldError(field: AccountField) {
    if (fieldErrors[field]) setClearedErrors((current) => ({...current, [field]: true}));
  }

  function changeMode(nextMode: AuthMode) {
    if (mode === nextMode) return;

    setMode(nextMode);
    setPassword("");
    setShowPassword(false);
    setCode("");
    setNotice(null);
    setValidationErrors({});
    setClearedErrors({});
    onClearError();
  }

  function showVerification(message: string | null) {
    setMode("verify-email");
    setShowPassword(false);
    setCode("");
    setNotice(message);
  }

  async function resendCode() {
    if (accountBusy) return;
    setValidationErrors({});
    setNotice(null);
    onClearError();
    try {
      await onResendVerification({email: email.trim(), password});
      setCode("");
      setNotice("A new verification code was sent.");
    } catch {
      // Request errors are displayed by the shared account form.
    }
  }

  async function submitAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (accountBusy) return;

    const form = event.currentTarget;
    const emailInput = form.elements.namedItem("email") as HTMLInputElement | null;
    const cleanedEmail = email.trim();
    const cleanedName = fullName.trim();
    const cleanedMobile = mobileNumber.trim();
    const cleanedCode = code.replace(/[\s-]/g, "").toUpperCase();
    const errors: Partial<Record<AccountField, string>> = {};

    if (isRegistering && cleanedName.length < 2) errors.fullName = "Enter a full name with at least 2 characters.";
    if (!isVerifying && !cleanedEmail) errors.email = "Enter your email address.";
    else if (emailInput?.validity.typeMismatch) errors.email = "Enter a valid email address.";
    if (!isVerifying && !password) errors.password = "Enter your password.";
    else if (isRegistering && password.length < 10) errors.password = "Use at least 10 characters.";
    if (isRegistering && !selectedRole) errors.role = "Select your primary role.";
    if (isVerifying && !/^[A-F0-9]{16}$/.test(cleanedCode)) errors.code = "Enter the 16-character code from your email.";

    setValidationErrors(errors);
    setClearedErrors({});
    setNotice(null);
    onClearError();
    const firstInvalidField = Object.keys(errors)[0];
    if (firstInvalidField) {
      requestAnimationFrame(() => {
        const field = form.elements.namedItem(firstInvalidField);
        if (field instanceof HTMLElement) field.focus();
      });
      return;
    }

    try {
      if (mode === "sign-in") {
        await onSignIn({email: cleanedEmail, password});
      } else if (mode === "register") {
        await onRegister({fullName: cleanedName, email: cleanedEmail, password, role,
          ...(cleanedMobile ? {mobileCountry, mobileNumber: cleanedMobile} : {}),
        });
        showVerification("Verification code sent.");
      } else {
        await onVerifyEmail({email: cleanedEmail, password, code: cleanedCode});
        changeMode("sign-in");
        setNotice("Email verified. You can now sign in.");
      }
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.code === "EMAIL_VERIFICATION_REQUIRED") {
        onClearError();
        showVerification(null);
      } else if (requestError instanceof ApiClientError && requestError.code === "EMAIL_DELIVERY_FAILED" && isRegistering) {
        showVerification(null);
      }
    }
  }

  const emailErrorId = `${formId}-email-error`;
  const passwordErrorId = `${formId}-password-error`;
  const nameErrorId = `${formId}-name-error`;
  const roleErrorId = `${formId}-role-error`;
  const roleHelpId = `${formId}-role-help`;
  const passwordHelpId = `${formId}-password-help`;
  const mobileErrorId = `${formId}-mobile-error`;
  const countryErrorId = `${formId}-country-error`;
  const codeErrorId = `${formId}-code-error`;

  return (
    <main className={styles.page}>
      <section className={styles.access} aria-labelledby="auth-form-title">
        <Link className={styles.brand} href={`/${locale}`}>
          <BrandLogo />
        </Link>

        <div className={styles.accessCard}>
          <div className={styles.selectorHeader}>
            <h1 id="auth-form-title">{isVerifying ? "Verify your email" : isRegistering ? "Create your account" : listingIntent ? "Sign in to list a property" : "Sign in to your workspace"}</h1>
            {isVerifying ? (
              <p>Enter the verification code for <strong>{email.trim()}</strong>. The code expires after 15 minutes.</p>
            ) : (
              <p>{isRegistering ? "Choose a role to get the right tools for your work." : "Use the email and password for your Property Pillar account."}</p>
            )}
          </div>

          {!isVerifying && <div className={styles.authTabs} aria-label="Account access" role="group">
            <button
              aria-controls={`${formId}-panel`}
              aria-pressed={!isRegistering}
              disabled={accountBusy}
              onClick={() => changeMode("sign-in")}
              type="button"
            >
              <LogIn size={15} aria-hidden="true" /> Sign in
            </button>
            <button
              aria-controls={`${formId}-panel`}
              aria-pressed={isRegistering}
              disabled={accountBusy}
              onClick={() => changeMode("register")}
              type="button"
            >
              <UserPlus size={15} aria-hidden="true" /> Register
            </button>
          </div>}

          {notice && <p className={styles.notice} role="status"><CheckCircle2 size={17} aria-hidden="true" />{notice}</p>}
          {providerMessage && <p className={styles.notice} role="status">{providerMessage}</p>}
          {!isVerifying && googleHref && <a className={styles.googleButton} href={googleHref}>Continue with Google</a>}

          {formError ? (
            <div className={styles.error} role="alert">
              <CircleAlert size={18} aria-hidden="true" />
              <p>{formError}</p>
            </div>
          ) : null}

          <form aria-busy={accountBusy} className={styles.accountForm} id={`${formId}-panel`} noValidate onSubmit={submitAccount} ref={formRef}>
            {isRegistering ? (
              <label>
                <span>Full name</span>
                <input
                  aria-describedby={fieldErrors.fullName ? nameErrorId : undefined}
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  autoComplete="name"
                  maxLength={100}
                  minLength={2}
                  name="fullName"
                  onChange={(event) => {setFullName(event.target.value); clearFieldError("fullName");}}
                  placeholder="Your full name"
                  required
                  value={fullName}
                />
                <FieldError id={nameErrorId} message={fieldErrors.fullName} />
              </label>
            ) : null}

            {!isVerifying && <label>
              <span>Email address</span>
              <input
                aria-describedby={fieldErrors.email ? emailErrorId : undefined}
                aria-invalid={Boolean(fieldErrors.email)}
                autoCapitalize="none"
                autoComplete="email"
                inputMode="email"
                maxLength={254}
                name="email"
                onChange={(event) => {setEmail(event.target.value); clearFieldError("email");}}
                placeholder="you@example.com"
                required
                spellCheck={false}
                type="email"
                value={email}
              />
              <FieldError id={emailErrorId} message={fieldErrors.email} />
            </label>}

            {isRegistering && <div className={styles.field}>
              <label htmlFor={`${formId}-mobile`}>Mobile number (optional)</label>
              <div className={styles.mobileField} dir="ltr">
                <CountryCallingCode
                  value={mobileCountry}
                  onChange={(country) => {setMobileCountry(country); clearFieldError("mobileCountry"); clearFieldError("mobileNumber");}}
                  invalid={Boolean(fieldErrors.mobileCountry)}
                  errorId={fieldErrors.mobileCountry ? countryErrorId : undefined}
                />
                <input
                  aria-describedby={fieldErrors.mobileNumber ? mobileErrorId : undefined}
                  aria-invalid={Boolean(fieldErrors.mobileNumber)}
                  autoComplete="tel-national"
                  id={`${formId}-mobile`}
                  maxLength={32}
                  name="mobileNumber"
                  onChange={(event) => {setMobileNumber(event.target.value); clearFieldError("mobileNumber");}}
                  placeholder="Enter mobile number"
                  type="tel"
                  value={mobileNumber}
                />
              </div>
              <FieldError id={countryErrorId} message={fieldErrors.mobileCountry} />
              <FieldError id={mobileErrorId} message={fieldErrors.mobileNumber} />
            </div>}

            {!isVerifying && <div className={styles.field}>
              <label htmlFor={`${formId}-password`}>Password</label>
              <div className={styles.passwordField}>
                <input
                  aria-describedby={fieldErrors.password ? passwordErrorId : isRegistering ? passwordHelpId : undefined}
                  aria-invalid={Boolean(fieldErrors.password)}
                  autoComplete={isRegistering ? "new-password" : "current-password"}
                  id={`${formId}-password`}
                  maxLength={128}
                  minLength={isRegistering ? 10 : 1}
                  name="password"
                  onChange={(event) => {setPassword(event.target.value); clearFieldError("password");}}
                  placeholder={isRegistering ? "Choose a password" : "Enter your password"}
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
              <FieldError id={passwordErrorId} message={fieldErrors.password} />
              {isRegistering && !fieldErrors.password ? (
                <small className={styles.fieldHint} id={passwordHelpId}>Use at least 10 characters.</small>
              ) : null}
            </div>}

            {isVerifying && <label>
              <span>Verification code</span>
              <input
                aria-describedby={fieldErrors.code ? codeErrorId : undefined}
                aria-invalid={Boolean(fieldErrors.code)}
                autoCapitalize="characters"
                autoComplete="one-time-code"
                dir="ltr"
                maxLength={48}
                name="code"
                onChange={(event) => {setCode(event.target.value); clearFieldError("code");}}
                placeholder="Enter the 16-character code"
                required
                spellCheck={false}
                value={code}
              />
              <FieldError id={codeErrorId} message={fieldErrors.code} />
            </label>}

            {isRegistering ? (
              <div className={styles.field}>
                <label htmlFor={`${formId}-role`}>Primary role</label>
                <select
                  aria-describedby={[selectedRole && roleHelpId, fieldErrors.role && roleErrorId].filter(Boolean).join(" ") || undefined}
                  aria-invalid={Boolean(fieldErrors.role)}
                  id={`${formId}-role`}
                  name="role"
                  onChange={(event) => {setRole(event.target.value as RegisterRole); clearFieldError("role");}}
                  required
                  value={role}
                >
                  {roles.map((option) => <option key={option.role} value={option.role}>{option.label}</option>)}
                </select>
                <FieldError id={roleErrorId} message={fieldErrors.role} />
                {selectedRole ? (
                  <span className={styles.roleContext} id={roleHelpId}>
                    {SelectedRoleIcon ? <SelectedRoleIcon size={17} aria-hidden="true" /> : null}
                    <small>{selectedRole.description}</small>
                  </span>
                ) : null}
              </div>
            ) : null}

            <button className={styles.submitButton} disabled={accountBusy} type="submit">
              {accountBusy ? <LoaderCircle className={styles.spin} size={17} aria-hidden="true" /> : null}
              {isVerifying ? "Verify email" : isRegistering ? "Create account" : "Sign in to workspace"}
              {!accountBusy ? <ArrowRight size={17} aria-hidden="true" /> : null}
            </button>
            {isVerifying && <div className={styles.verificationActions}>
              <button disabled={accountBusy} onClick={() => changeMode("sign-in")} type="button">Back to sign in</button>
              <button disabled={accountBusy} onClick={() => void resendCode()} type="button">Resend code</button>
            </div>}
          </form>
        </div>

        <p className={styles.securityNote}><LockKeyhole size={15} aria-hidden="true" /> Secure account access</p>
      </section>

      <aside className={styles.intro} aria-label="About your workspace">
        <Image alt="" className={styles.introPhoto} fill sizes="(min-width: 881px) 49vw, 1px" src={marketplaceArtwork.interior} />
        <div className={styles.introBody}>
          <p className={styles.introTitle}>Manage your property work in one place.</p>
          <p>Track listings, requests, quotes and hiring from the workspace built for your role.</p>
        </div>
      </aside>
    </main>
  );
}
