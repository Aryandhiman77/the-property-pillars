"use client";

import {MaterialInput, MaterialSelect} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import OutlinedInput from "@mui/material/OutlinedInput";

import {useEffect, useId, useRef, useState, type FormEvent} from "react";
import {ArrowRight, Eye, EyeOff, MailCheck, ShieldCheck, X} from "lucide-react";
import {normalizeContactPhone} from "@the-property-pillar/contracts";
import {PhoneInput, formPhone} from "@/components/ui/phone-input";
import {ApiClientError, apiRequest} from "@/lib/api/client";
import {clearChangedField, fieldAttributes, focusInvalidControl, invalidControls, splitFieldErrors, type FieldErrors} from "@/lib/form-validation";
import type {RegisterRole} from "./types";
import styles from "./mobile-auth.module.css";

export type CompletionRole = {role: RegisterRole; label: string};
export type MobileOnboarding = {confirmExistingEmail?: boolean; challengeId: string; phone: string; fullName?: string; email?: string | null; role?: RegisterRole};
export type GoogleOnboarding = {fullName: string; email: string; phone?: string; role?: RegisterRole};
const formKeys = ["firstName", "lastName", "fullName", "email", "phone", "role", "password", "confirmPassword", "code"];

function PasswordField({formId, name, error}: {
  formId: string; name: "password" | "confirmPassword"; error?: string;
}) {
  const [visible, setVisible] = useState(false);
  const first = name === "password";
  const label = first ? "Password" : "Confirm password";
  const inputId = `${formId}-${name}-input`;
  const Icon = visible ? EyeOff : Eye;

  return <div className={styles.passwordField}>
    <label htmlFor={inputId}>{label}</label>
    <OutlinedInput className="material-field" id={inputId} name={name} type={visible ? "text" : "password"}
      autoComplete="new-password" required error={Boolean(error)}
      placeholder={first ? "At least 10 characters" : undefined}
      inputProps={{...fieldAttributes(formId, name, error), minLength: first ? 10 : undefined, maxLength: 128}}
      endAdornment={<InputAdornment position="end">
        <IconButton type="button" edge="end" aria-controls={inputId}
          aria-label={`${visible ? "Hide" : "Show"} ${first ? "password" : "confirm password"}`}
          onMouseDown={event => event.preventDefault()} onClick={() => setVisible(value => !value)}>
          <Icon size={19} aria-hidden="true" />
        </IconButton>
      </InputAdornment>} />
    {error && <small id={`${formId}-${name}`} role="alert">{error}</small>}
  </div>;
}

export function AccountCompletionDialog({info, roles, finish, restart, onDismiss}: {
  info: MobileOnboarding | GoogleOnboarding; roles: CompletionRole[];
  finish: (next?: string) => void; restart: () => void; onDismiss: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [email, setEmail] = useState("");
  const [linkCodeSent, setLinkCodeSent] = useState(false);
  const [details, setDetails] = useState<{firstName: string; lastName: string; email: string; role: string}>();
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const mobile = "challengeId" in info ? info : undefined;
  const [firstName = "", ...lastName] = (info.fullName ?? "").trim().split(/\s+/);
  const linking = Boolean(mobile?.confirmExistingEmail);
  const verifyEmail = Boolean(mobile && (email || linkCodeSent));
  const Icon = verifyEmail ? MailCheck : ShieldCheck;

  useEffect(() => { dialog.current?.showModal(); }, []);

  function fieldError(key: string) {
    return errors[key] && <small id={`${id}-${key}`} role="alert">{errors[key]}</small>;
  }

  async function perform(action: () => Promise<void>, form?: HTMLFormElement) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    setNotice("");
    try {await action();}
    catch (error) {
      if (error instanceof ApiClientError && ["MOBILE_SIGNUP_EXPIRED", "GOOGLE_FLOW_EXPIRED"].includes(error.code ?? "")) setExpired(true);
      if (error instanceof ApiClientError && Object.keys(error.fieldErrors).length) {
        const {fields, general} = splitFieldErrors(error.fieldErrors, formKeys);
        setErrors(fields);
        setMessage(general || (verifyEmail && !fields.code ? error.message : ""));
        if (form) focusInvalidControl(form);
      } else setMessage(error instanceof Error ? error.message : "Could not complete sign-in. Please try again.");
    } finally {pending.current = false; setBusy(false);}
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const value = (key: string) => String(values.get(key) ?? "");
    const invalid = invalidControls(form);
    const phone = mobile?.phone ?? normalizeContactPhone(formPhone(values));
    const role = info.role ?? value("role");
    const code = value("code").replace(/[\s-]/g, "").toUpperCase();
    if (verifyEmail && !/^[A-F0-9]{16}$/.test(code)) invalid.code = "Enter the 16-character code from your email.";
    if (!mobile && value("phone") && !phone?.startsWith("+")) invalid.phone = "Enter a valid mobile number with country code.";
    if (mobile && !verifyEmail && value("password") !== value("confirmPassword")) invalid.confirmPassword = "Passwords must match.";
    setErrors(invalid);
    if (Object.keys(invalid).length) {focusInvalidControl(form); return;}
    void perform(async () => {
      if (!mobile) {
        const result = await apiRequest<{next: string}>("/auth/google/complete", {method: "POST", body: {fullName: value("fullName"), phone: phone || undefined, role}});
        finish(result.next);
      } else if (verifyEmail) {
        await apiRequest("/auth/mobile/complete/verify-email", {method: "POST", body: {challengeId: mobile.challengeId, code}});
        finish();
      } else if (linking) {
        await apiRequest("/auth/mobile/complete/resend", {method: "POST", body: {challengeId: mobile.challengeId}});
        setLinkCodeSent(true);
      } else {
        const address = value("email").trim();
        const signupDetails = {firstName: value("firstName"), lastName: value("lastName"), email: address, role};
        setDetails(signupDetails);
        try {
          await apiRequest("/auth/mobile/complete", {method: "POST", body: {
            challengeId: mobile.challengeId, ...signupDetails, password: value("password"), confirmPassword: value("confirmPassword"),
          }});
        } catch (error) {
          if (error instanceof ApiClientError && error.code === "EMAIL_DELIVERY_FAILED") setEmail(address);
          throw error;
        }
        setEmail(address);
      }
    }, form);
  }

  function dismiss() {
    if (pending.current) return;
    dialog.current?.close();
    onDismiss();
  }

  return <dialog ref={dialog} className={`${styles.dialog} ${styles.completionDialog}`}
    aria-labelledby={id + "-title"} aria-describedby={id + "-intro"}
    onCancel={event => {event.preventDefault(); dismiss();}}>
    <header className={styles.completionHeader}>
      <span className={styles.icon}><Icon size={23} aria-hidden="true" /></span>
      <div>
        <h2 id={id + "-title"}>{verifyEmail ? "Verify your email" : linking ? "Confirm your existing account" : "Complete your account"}</h2>
        <p id={id + "-intro"}>{verifyEmail ? <>Enter the code sent to <bdi>{linking ? "your registered email address" : email}</bdi>.</> : linking ? "Confirm your registered email once to enable mobile sign-in for this account." : mobile ? "Mobile verified. Enter your details to finish signing in." : "Review your Google details. You can continue without a mobile number."}</p>
      </div>
      <IconButton type="button" disabled={busy} onClick={dismiss} className={styles.closeButton} aria-label="Close account setup">
        <X size={20} aria-hidden="true" />
      </IconButton>
    </header>
    <form className={`${styles.form} ${styles.completionForm}`} onSubmit={submit} onChange={(event) => clearChangedField(event, setErrors)} noValidate aria-busy={busy}>
      {expired ? <MuiButton className={styles.submit} type="button" onClick={restart}>{mobile ? "Verify mobile again" : "Restart Google sign-in"} <ArrowRight size={16} aria-hidden="true" /></MuiButton> : <>
        {verifyEmail && mobile ? <>
          <label>Email verification code<MaterialInput {...fieldAttributes(id, "code", errors.code)} autoComplete="one-time-code" autoFocus required maxLength={24} />{fieldError("code")}</label>
          <div className={styles.actions}>
            {!linking && <MuiButton type="button" disabled={busy} onClick={() => {setEmail(""); setErrors({}); setNotice(""); setMessage("");}}>Edit details</MuiButton>}
            <MuiButton type="button" disabled={busy} onClick={() => {
              setErrors({});
              void perform(async () => {
                await apiRequest("/auth/mobile/complete/resend", {method: "POST", body: {challengeId: mobile.challengeId}});
                setNotice("A new verification code was sent.");
              });
            }}>Resend code</MuiButton>
          </div>
        </> : linking ? null : <>
          {mobile ? <div className={styles.completionNames}>
            <label>First name<MaterialInput {...fieldAttributes(id, "firstName", errors.firstName)} autoFocus required defaultValue={details?.firstName ?? firstName} maxLength={50} autoComplete="given-name" />{fieldError("firstName")}</label>
            <label><span>Last name <span className={styles.optional}>(optional)</span></span><MaterialInput {...fieldAttributes(id, "lastName", errors.lastName)} defaultValue={details?.lastName ?? lastName.join(" ")} maxLength={49} autoComplete="family-name" />{fieldError("lastName")}</label>
          </div> : <label>Full name<MaterialInput {...fieldAttributes(id, "fullName", errors.fullName)} required minLength={2} maxLength={100} autoComplete="name" defaultValue={info.fullName} />{fieldError("fullName")}</label>}
          <label>Email address<MaterialInput {...fieldAttributes(id, "email", errors.email)} autoComplete="email" type="email" required readOnly={!mobile || Boolean(mobile.email)} defaultValue={details?.email ?? info.email ?? ""} maxLength={254} />{fieldError("email")}</label>
          {mobile ? <label>Verified mobile number<MaterialInput type="tel" value={mobile.phone} dir="ltr" readOnly /></label> :
            <div className={styles.phoneField}><label htmlFor={id + "-mobile"}>Mobile number (optional)</label>
              <PhoneInput {...fieldAttributes(id, "phone", errors.phone)} name="phone" id={id + "-mobile"} className={styles.input} defaultValue={info.phone} />
              {fieldError("phone")}
            </div>}
          <label>Account role<MaterialSelect {...fieldAttributes(id, "role", errors.role)} required disabled={Boolean(info.role)}
            defaultValue={info.role ?? details?.role ?? (roles.length === 1 ? roles[0].role : "")}>
            <option value="">Select your role</option>
            {info.role && !roles.some(({role}) => role === info.role) && <option value={info.role}>{info.role.replaceAll("_", " ")}</option>}
            {roles.map(({role, label}) => <option key={role} value={role}>{label}</option>)}
          </MaterialSelect>{fieldError("role")}</label>
          {mobile && <div className={styles.passwords}>
            <PasswordField formId={id} name="password" error={errors.password} />
            <PasswordField formId={id} name="confirmPassword" error={errors.confirmPassword} />
          </div>}
        </>}
        <MuiButton variant="contained" className={styles.submit} disabled={busy} type="submit">{busy ? "Please wait…" : verifyEmail || !mobile ? "Sign in" : "Send email verification code"} <ArrowRight size={16} aria-hidden="true" /></MuiButton>
      </>}
      {notice && <p className={styles.completionNotice} role="status">{notice}</p>}
      {message && <small role="alert">{message}</small>}
    </form>
  </dialog>;
}
