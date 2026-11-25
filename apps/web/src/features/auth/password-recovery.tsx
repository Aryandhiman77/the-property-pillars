"use client";

import {MaterialInput} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";

import {ArrowLeft, ArrowRight, LoaderCircle, Mail} from "lucide-react";
import {useId, useRef, useState, type FormEvent} from "react";
import {ApiClientError, apiRequest} from "@/lib/api/client";
import {clearChangedField, fieldAttributes, focusInvalidControl, invalidControls, splitFieldErrors} from "@/lib/form-validation";
import styles from "./auth-access.module.css";

export function PasswordRecovery({email: initialEmail, onBack}: {
  email: string;
  onBack: (email: string, reset?: boolean) => void;
}) {
  const id = useId();
  const [email, setEmail] = useState(initialEmail);
  const [codeRequested, setCodeRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const back = () => onBack(email.trim());
  const field = (name: string) => fieldAttributes(id, name, errors[name]);
  const issue = (name: string) => errors[name] && (
    <small className={styles.fieldError} role="alert" id={`${id}-${name}`}>{errors[name]}</small>
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const nextErrors = invalidControls(form);
    const code = String(values.get("code") ?? "").replace(/[\s-]/g, "").toUpperCase();
    const newPassword = String(values.get("newPassword") ?? "");
    setMessage("");
    if (codeRequested) {
      if (!/^[A-F0-9]{16}$/.test(code)) nextErrors.code = "Enter the 16-character code from your email.";
      if (newPassword.length < 10) nextErrors.newPassword = "Use at least 10 characters.";
      if (newPassword !== values.get("confirmPassword")) nextErrors.confirmPassword = "The passwords must match.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      focusInvalidControl(form);
      return;
    }

    lock.current = true;
    setBusy(true);
    const cleanedEmail = email.trim();
    try {
      if (codeRequested) {
        await apiRequest("/auth/password/reset/complete", {method: "POST", body: {email: cleanedEmail, code, newPassword}});
        onBack(cleanedEmail, true);
      } else {
        await apiRequest("/auth/password/reset/request", {method: "POST", body: {email: cleanedEmail}});
        setCodeRequested(true);
      }
    } catch (error) {
      if (error instanceof ApiClientError && Object.keys(error.fieldErrors).length) {
        const {fields, general} = splitFieldErrors(error.fieldErrors, ["email", "code", "newPassword"]);
        setErrors(fields);
        setMessage(general);
        focusInvalidControl(form);
      } else {
        setMessage(error instanceof Error ? error.message : "Password reset is unavailable. Try again.");
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return <>
    <div className={styles.selectorHeader}>
      <h1 id="auth-form-title">{codeRequested ? "Choose a new password" : "Reset your password"}</h1>
      <p>{codeRequested ? "If this address is eligible for password recovery, a code will arrive by email." : "Enter the email address associated with your account."}</p>
    </div>
    {message && <p className={styles.error} role="alert">{message}</p>}
    <form className={styles.accountForm} noValidate aria-busy={busy}
      onSubmit={submit} onChange={(event) => clearChangedField(event, setErrors)}>
      <label>
        <span className={styles.fieldLabel}><Mail size={18} aria-hidden="true" />Email address</span>
        <MaterialInput {...field("email")} type="email" autoComplete="email" maxLength={254} required readOnly={codeRequested}
          value={email} placeholder="you@example.com" onChange={(event) => setEmail(event.target.value)} />
        {issue("email")}
      </label>
      {codeRequested && <>
        <label><span>Email code</span>
          <MaterialInput {...field("code")} autoComplete="one-time-code" maxLength={48} spellCheck={false}
            placeholder="Enter the 16-character code" required />
          {issue("code")}
        </label>
        <label><span>New password</span>
          <MaterialInput {...field("newPassword")} type="password" autoComplete="new-password" minLength={10} maxLength={128} required />
          {issue("newPassword")}
        </label>
        <label><span>Confirm new password</span>
          <MaterialInput {...field("confirmPassword")} type="password" autoComplete="new-password" maxLength={128} required />
          {issue("confirmPassword")}
        </label>
      </>}
      <MuiButton variant="contained" className={styles.submitButton} type="submit" disabled={busy}>
        {busy ? <LoaderCircle className={styles.spin} size={17} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
        {codeRequested ? "Reset password" : "Send reset code"}
      </MuiButton>
      <div className={styles.verificationActions}>
        <MuiButton type="button" disabled={busy} onClick={back}><ArrowLeft size={15} aria-hidden="true" />Back to sign in</MuiButton>
        {codeRequested && <MuiButton type="button" disabled={busy} onClick={() => {
          setCodeRequested(false);
          setErrors({});
          setMessage("");
        }}>Request another code</MuiButton>}
      </div>
    </form>
  </>;
}
