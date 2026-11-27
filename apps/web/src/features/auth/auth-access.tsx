"use client";

import {MaterialInput, MaterialSelect} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import {useLocale, useTranslations} from "next-intl";
import {MarketplaceBreadcrumbs} from "@/components/layout/marketplace-breadcrumbs";
import {LocaleMenu} from "@/components/layout/locale-menu";
import {useSiteLocation} from "@/features/location/site-location";
import {isSupportedCountry, parsePhoneNumberFromString, type CountryCode} from "libphonenumber-js/min";
import {useEffect, useId, useRef, useState} from "react";
import type {LucideIcon} from "lucide-react";
import {
  ArrowRight,
  ChartNoAxesColumnIncreasing,
  CheckCircle2,
  CircleAlert,
  Eye,
  EyeOff,
  FileText,
  House,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound,
  UserPlus,
  UsersRound,
} from "lucide-react";
import {BrandLogo} from "@/components/layout/brand-logo";
import {focusInvalidControl} from "@/lib/form-validation";

import type {RegisterRole, RegistrationInput, SignInInput} from "./types";
import type {AuthError} from "./use-session";
import {PasswordRecovery} from "./password-recovery";
import {useMobilePrompt} from "./mobile-auth";
import styles from "./auth-access.module.css";

const CountryCallingCode = dynamic(() => import("./country-calling-code").then((module) => module.CountryCallingCode), {
  loading: () => <span className={styles.countryValue} aria-hidden="true">+91</span>,
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
  onRegistrationComplete: () => void;
  onSignIn: (input: SignInInput) => Promise<void>;
  onRegister: (input: RegistrationInput) => Promise<void>;
  onVerifyEmail: (input: {code: string}) => Promise<void>;
  onResendVerification: () => Promise<void>;
};

type AuthMode = "sign-in" | "register" | "verify-email";
type AccountField = "fullName" | "email" | "password" | "role" | "mobileCountry" | "mobileNumber" | "confirmPassword" | "code";

const workspaceFeatures = [
  {lines: ["Manage", "Listings"], icon: House},
  {lines: ["Track", "Enquiries"], icon: UsersRound},
  {lines: ["Create", "Quotes"], icon: FileText},
  {lines: ["Grow Your", "Business"], icon: ChartNoAxesColumnIncreasing},
];

function FieldError({id, message}: {id: string; message?: string}) {
  return message ? <small className={styles.fieldError} id={id} role="alert">{message}</small> : null;
}

export function AuthAccess({roles, listingIntent, googleHref, providerMessage, accountBusy, error, onClearError, onRegistrationComplete, onSignIn, onRegister, onVerifyEmail, onResendVerification}: AuthAccessProps) {
  const t = useTranslations("Site");
  const mobile = useMobilePrompt();
  const locale = useLocale();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobileCountryOverride, setMobileCountry] = useState("");
  const {place} = useSiteLocation();
  const detectedCountry = place?.countryCode as CountryCode | undefined;
  const mobileCountry = mobileCountryOverride || (detectedCountry && isSupportedCountry(detectedCountry) ? detectedCountry : "IN");
  const [mobileNumber, setMobileNumber] = useState("");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [role, setRole] = useState<RegisterRole>(listingIntent && roles.some(option => option.role === "OWNER") ? "OWNER" : roles[0]?.role ?? "BUYER");
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
    setConfirmPassword("");
    setShowConfirmPassword(false);
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
      await onResendVerification();
      setCode("");
      setEmailCodeSent(true);
      setNotice("A verification code was sent.");
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
    if (!isVerifying && !cleanedEmail) errors.email = isRegistering ? "Enter your email address." : "Enter your email, mobile number or username.";
    else if (emailInput?.validity.typeMismatch) errors.email = "Enter a valid email address.";
    if (!isVerifying && !password) errors.password = "Enter your password.";
    else if (isRegistering && password.length < 10) errors.password = "Use at least 10 characters.";
    if (isRegistering && (!confirmPassword || confirmPassword !== password)) errors.confirmPassword = "Enter the same password again.";
    if (isRegistering && !selectedRole) errors.role = "Select your primary role.";
    if (isVerifying && emailCodeSent && !/^[A-F0-9]{16}$/.test(cleanedCode)) errors.code = "Enter the 16-character code from your email.";

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
        await onSignIn({email: cleanedEmail, password, rememberMe});
      } else if (mode === "register") {
        await onRegister({fullName: cleanedName, email: cleanedEmail, password, role,
          ...(cleanedMobile ? {mobileCountry, mobileNumber: cleanedMobile} : {}),
        });
        setPassword("");
        setConfirmPassword("");
        setShowPassword(false);
        setShowConfirmPassword(false);
        if (cleanedMobile) {
          const phone = parsePhoneNumberFromString(cleanedMobile, mobileCountry as CountryCode)?.number;
          await mobile.verify({mode: "profile", identity: {phone}});
        }
        setEmailCodeSent(false);
        showVerification("Your account is ready. You can verify your email now or skip this step.");
      } else if (!emailCodeSent) {
        await resendCode();
      } else {
        await onVerifyEmail({code: cleanedCode});
        onRegistrationComplete();
      }
    } catch {
      // The account request exposes its error above the form.
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
      <div className={styles.scene} aria-hidden="true">
        <Image alt="" src="/images/daylight/auth-villa.webp" fill priority sizes="100vw" />
      </div>
      <section className={styles.access} aria-labelledby="auth-form-title">
        <div className={styles.accessHeader}>
          <Link className={styles.brand} href={`/${locale}`}><BrandLogo width={226} /></Link>
          <LocaleMenu />
        </div>

        <div className={styles.accessCard} data-motion="enter">
          <MarketplaceBreadcrumbs locale={locale} current={t(recovering ? "forgotPassword" : isVerifying ? "verifyEmail" : isRegistering ? "registerTitle" : "signIn")} />
          {recovering ? <PasswordRecovery email={email.includes("@") ? email : ""} onBack={(address, reset) => {
            setEmail(address);
            setRecovering(false);
            if (reset) setNotice("Password reset. Sign in with your new password.");
          }} /> : <>
          <div className={styles.selectorHeader}>
            {!isVerifying && <p className={styles.eyebrow}>{t(isRegistering ? "getStarted" : "welcomeBack")}</p>}
            <h1 id="auth-form-title">{t(isVerifying ? "verifyEmail" : isRegistering ? "registerTitle" : listingIntent ? "signInToList" : "signInTitle")}</h1>
            {isVerifying ? (
              <p>{emailCodeSent ? "Enter the code sent to" : "Send a verification code to"} <strong>{email.trim()}</strong>.</p>
            ) : (
              <p>{isRegistering ? "Choose a role to get the right tools for your work." : t("signInHelp")}</p>
            )}
          </div>

          {!isVerifying && <div className={styles.authTabs} aria-label="Account access" role="group">
            <MuiButton
              aria-controls={`${formId}-panel`}
              aria-pressed={!isRegistering}
              disabled={accountBusy}
              onClick={() => changeMode("sign-in")}
              type="button"
            >
              <UserRound size={18} aria-hidden="true" />{t("signIn")}
            </MuiButton>
            <MuiButton
              aria-controls={`${formId}-panel`}
              aria-pressed={isRegistering}
              disabled={accountBusy}
              onClick={() => changeMode("register")}
              type="button"
            >
              <UserPlus size={18} aria-hidden="true" />{t("register")}
            </MuiButton>
          </div>}

          {notice && <p className={styles.notice} role="status"><CheckCircle2 size={17} aria-hidden="true" />{notice}</p>}
          {providerMessage && <p className={styles.notice} role="status">{providerMessage}</p>}
          {mobile.dialog}
          {!isVerifying && googleHref && <>
            <a className={styles.googleButton} href={googleHref}>
              <Image src="/images/google-sign-in.webp" alt="" width={20} height={20} />{t("google")}
            </a>
            <div className={styles.divider}>{isRegistering ? t("emailRegister") : "Or sign in with your password"}</div>
          </>}

          {formError ? (
            <div className={styles.error} role="alert">
              <CircleAlert size={18} aria-hidden="true" />
              <p>{formError}</p>
            </div>
          ) : null}

          <form aria-busy={accountBusy} className={styles.accountForm} id={`${formId}-panel`} noValidate onSubmit={submitAccount} ref={formRef}>
            {isRegistering ? (
              <label>
                <span>{t("fullName")}</span>
                <MaterialInput
                  aria-describedby={fieldErrors.fullName ? nameErrorId : undefined}
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  autoComplete="name"
                  maxLength={100}
                  minLength={2}
                  name="fullName"
                  onChange={(event) => {setFullName(event.target.value); clearFieldError("fullName");}}
                  placeholder={t("fullName")}
                  required
                  value={fullName}
                />
                <FieldError id={nameErrorId} message={fieldErrors.fullName} />
              </label>
            ) : null}

            {!isVerifying && <label>
              <span className={styles.fieldLabel}><Mail size={18} aria-hidden="true" />{isRegistering ? t("email") : "Email, mobile number or username"}</span>
              <MaterialInput
                aria-describedby={fieldErrors.email ? emailErrorId : undefined}
                aria-invalid={Boolean(fieldErrors.email)}
                autoCapitalize="none"
                autoComplete={isRegistering ? "email" : "username"}
                inputMode={isRegistering ? "email" : "text"}
                maxLength={254}
                name="email"
                onChange={(event) => {setEmail(event.target.value); clearFieldError("email");}}
                placeholder={isRegistering ? "you@example.com" : "Email, mobile number or username"}
                required
                spellCheck={false}
                type={isRegistering ? "email" : "text"}
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
                <MaterialInput
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
              <label className={styles.fieldLabel} htmlFor={`${formId}-password`}><LockKeyhole size={18} aria-hidden="true" />{t("password")}</label>
              <div className={styles.passwordField}>
                <MaterialInput
                  aria-describedby={fieldErrors.password ? passwordErrorId : isRegistering ? passwordHelpId : undefined}
                  aria-invalid={Boolean(fieldErrors.password)}
                  autoComplete={isRegistering ? "new-password" : "current-password"}
                  id={`${formId}-password`}
                  maxLength={128}
                  minLength={isRegistering ? 10 : 1}
                  name="password"
                  onChange={(event) => {setPassword(event.target.value); clearFieldError("password");}}
                  placeholder={t(isRegistering ? "choosePassword" : "enterPassword")}
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <MuiButton
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </MuiButton>
              </div>
              <FieldError id={passwordErrorId} message={fieldErrors.password} />
              {isRegistering && !fieldErrors.password ? (
                <small className={styles.fieldHint} id={passwordHelpId}>Use at least 10 characters.</small>
              ) : null}
            </div>}

            {isRegistering && <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={formId + "-confirm"}>Confirm password</label>
              <div className={styles.passwordField}>
                <MaterialInput id={formId + "-confirm"} name="confirmPassword" autoComplete="new-password" required maxLength={128}
                  type={showConfirmPassword ? "text" : "password"} value={confirmPassword}
                  aria-invalid={Boolean(fieldErrors.confirmPassword)} aria-describedby={fieldErrors.confirmPassword ? formId + "-confirm-error" : undefined}
                  onChange={event => {setConfirmPassword(event.target.value); clearFieldError("confirmPassword");}} />
                <MuiButton type="button" aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}
                  onClick={() => setShowConfirmPassword(current => !current)}>
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </MuiButton>
              </div>
              <FieldError id={formId + "-confirm-error"} message={fieldErrors.confirmPassword} />
            </div>}
            {isVerifying && emailCodeSent && <label>
              <span>Verification code</span>
              <MaterialInput
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
                <MaterialSelect
                  aria-describedby={[selectedRole && roleHelpId, fieldErrors.role && roleErrorId].filter(Boolean).join(" ") || undefined}
                  aria-invalid={Boolean(fieldErrors.role)}
                  id={`${formId}-role`}
                  name="role"
                  onChange={(event) => {setRole(event.target.value as RegisterRole); clearFieldError("role");}}
                  required
                  value={role}
                >
                  {roles.map((option) => <option key={option.role} value={option.role}>{option.label}</option>)}
                </MaterialSelect>
                <FieldError id={roleErrorId} message={fieldErrors.role} />
                {selectedRole ? (
                  <span className={styles.roleContext} id={roleHelpId}>
                    {SelectedRoleIcon ? <SelectedRoleIcon size={17} aria-hidden="true" /> : null}
                    <small>{selectedRole.description}</small>
                  </span>
                ) : null}
              </div>
            ) : null}

            {!isRegistering && !isVerifying && <div className={styles.signInOptions}>
              <label><MaterialInput type="checkbox" name="rememberMe" checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)} />{t("rememberMe")}</label>
              <MuiButton disabled={accountBusy} type="button" onClick={() => {
                setPassword("");
                setShowPassword(false);
                setValidationErrors({});
                setClearedErrors({});
                setNotice(null);
                onClearError();
                setRecovering(true);
              }}>{t("forgotPassword")}</MuiButton>
            </div>}
            <MuiButton variant="contained" className={styles.submitButton} disabled={accountBusy} type="submit">
              {accountBusy ? <LoaderCircle className={styles.spin} size={17} aria-hidden="true" /> : null}
              {isVerifying ? (emailCodeSent ? t("verifyEmail") : "Send email verification code") : isRegistering ? t("registerTitle") : t("signInWorkspace")}
              {!accountBusy ? <ArrowRight size={17} aria-hidden="true" /> : null}
            </MuiButton>
            {isVerifying && <div className={styles.verificationActions}>
              <MuiButton disabled={accountBusy} onClick={onRegistrationComplete} type="button">Skip for now</MuiButton>
              {emailCodeSent && <MuiButton disabled={accountBusy} onClick={() => void resendCode()} type="button">Resend code</MuiButton>}
            </div>}
          </form>
          </>}
        </div>
      </section>

      <aside className={styles.intro} aria-label="About your workspace">
        <p className={styles.introTitle}>Manage your<br />property work<br />in <strong>one place.</strong></p>
        <ul className={styles.features}>
          {workspaceFeatures.map(({lines, icon: Icon}) => <li key={lines[0]}>
            <Icon size={36} strokeWidth={1.55} aria-hidden="true" />
            <span>{lines[0]}<br />{lines[1]}</span>
          </li>)}
        </ul>
      </aside>
    </main>
  );
}
