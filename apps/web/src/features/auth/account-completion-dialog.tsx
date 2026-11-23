"use client";

import {useEffect, useId, useRef, useState, type FormEvent} from "react";
import {ArrowRight, MailCheck, ShieldCheck} from "lucide-react";
import {normalizeContactPhone} from "@the-property-pillar/contracts";
import {PhoneInput, formPhone} from "@/components/ui/phone-input";
import {ApiClientError, apiRequest} from "@/lib/api/client";
import {clearChangedField, fieldAttributes, focusInvalidControl, invalidControls, splitFieldErrors, type FieldErrors} from "@/lib/form-validation";
import type {RegisterRole} from "./types";
import styles from "./mobile-auth.module.css";

export type CompletionRole = {role: RegisterRole; label: string};
export type MobileOnboarding = {challengeId: string; phone: string; fullName?: string; email?: string | null; role?: RegisterRole};
export type GoogleOnboarding = {fullName: string; email: string; phone?: string; role?: RegisterRole};
const formKeys = ["firstName", "lastName", "fullName", "email", "phone", "role", "password", "confirmPassword", "code"];

export function AccountCompletionDialog({info, roles, finish, restart}: {
  info: MobileOnboarding | GoogleOnboarding; roles: CompletionRole[];
  finish: (next?: string) => void; restart: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [email, setEmail] = useState("");
  const [details, setDetails] = useState<{firstName: string; lastName: string; email: string; role: string}>();
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const mobile = "challengeId" in info ? info : undefined;
  const [firstName = "", ...lastName] = (info.fullName ?? "").trim().split(/\s+/);
  const verifyEmail = Boolean(mobile && email);
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
    if (!mobile && !phone?.startsWith("+")) invalid.phone = "Enter a valid mobile number with country code.";
    if (mobile && !verifyEmail && value("password") !== value("confirmPassword")) invalid.confirmPassword = "Passwords must match.";
    setErrors(invalid);
    if (Object.keys(invalid).length) {focusInvalidControl(form); return;}
    void perform(async () => {
      if (!mobile) {
        const result = await apiRequest<{next: string}>("/auth/google/complete", {method: "POST", body: {fullName: value("fullName"), phone, role}});
        finish(result.next);
      } else if (verifyEmail) {
        await apiRequest("/auth/mobile/complete/verify-email", {method: "POST", body: {challengeId: mobile.challengeId, code}});
        finish();
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

  return <dialog ref={dialog} className={`${styles.dialog} ${styles.completionDialog}`} aria-labelledby={id + "-title"}
    onCancel={(event) => event.preventDefault()}>
    <div className={styles.windowDots} aria-hidden="true"><i /><i /><i /></div>
    <form className={`${styles.form} ${styles.completionForm}`} onSubmit={submit} onChange={(event) => clearChangedField(event, setErrors)} noValidate aria-busy={busy}>
      <header className={styles.completionHeader}>
        <span className={styles.icon}><Icon size={24} aria-hidden="true" /></span>
        <h2 id={id + "-title"}>{verifyEmail ? "Verify your email" : "Complete your account"}</h2>
        <p>{verifyEmail ? <>Enter the code sent to <bdi>{email}</bdi>.</> : mobile ? "Mobile verified. Enter your details to finish signing in." : "Review your Google details and add any missing information."}</p>
      </header>
      {expired ? <button className={styles.submit} type="button" onClick={restart}>{mobile ? "Verify mobile again" : "Restart Google sign-in"} <ArrowRight size={16} aria-hidden="true" /></button> : <>
        {verifyEmail && mobile ? <>
          <label>Email verification code<input {...fieldAttributes(id, "code", errors.code)} autoComplete="one-time-code" autoFocus required maxLength={24} />{fieldError("code")}</label>
          <div className={styles.actions}>
            <button type="button" disabled={busy} onClick={() => {setEmail(""); setErrors({}); setNotice(""); setMessage("");}}>Edit details</button>
            <button type="button" disabled={busy} onClick={() => {
              setErrors({});
              void perform(async () => {
                await apiRequest("/auth/mobile/complete/resend", {method: "POST", body: {challengeId: mobile.challengeId}});
                setNotice("A new verification code was sent.");
              });
            }}>Resend code</button>
          </div>
        </> : <>
          {mobile ? <div className={styles.completionNames}>
            <label>First name<input {...fieldAttributes(id, "firstName", errors.firstName)} autoFocus required defaultValue={details?.firstName ?? firstName} maxLength={50} autoComplete="given-name" />{fieldError("firstName")}</label>
            <label>Last name <span className={styles.optional}>(optional)</span><input {...fieldAttributes(id, "lastName", errors.lastName)} defaultValue={details?.lastName ?? lastName.join(" ")} maxLength={49} autoComplete="family-name" />{fieldError("lastName")}</label>
          </div> : <label>Full name<input {...fieldAttributes(id, "fullName", errors.fullName)} required minLength={2} maxLength={100} autoComplete="name" defaultValue={info.fullName} />{fieldError("fullName")}</label>}
          <label>Email address<input {...fieldAttributes(id, "email", errors.email)} autoComplete="email" type="email" required readOnly={!mobile || Boolean(mobile.email)} defaultValue={details?.email ?? info.email ?? ""} maxLength={254} />{fieldError("email")}</label>
          {mobile ? <label>Verified mobile number<input type="tel" value={mobile.phone} dir="ltr" readOnly /></label> :
            <div className={styles.phoneField}><label htmlFor={id + "-mobile"}>Mobile number</label>
              <PhoneInput {...fieldAttributes(id, "phone", errors.phone)} name="phone" id={id + "-mobile"} className={styles.input} defaultValue={info.phone} required />
              {fieldError("phone")}
            </div>}
          <label>Account role<select {...fieldAttributes(id, "role", errors.role)} required disabled={Boolean(info.role)}
            defaultValue={info.role ?? details?.role ?? (roles.length === 1 ? roles[0].role : "")}>
            <option value="">Select your role</option>
            {info.role && !roles.some(({role}) => role === info.role) && <option value={info.role}>{info.role.replaceAll("_", " ")}</option>}
            {roles.map(({role, label}) => <option key={role} value={role}>{label}</option>)}
          </select>{fieldError("role")}</label>
          {mobile && <>
            <label>Password<input {...fieldAttributes(id, "password", errors.password)} type="password" required minLength={10} maxLength={128} autoComplete="new-password" placeholder="At least 10 characters" />{fieldError("password")}</label>
            <label>Confirm password<input {...fieldAttributes(id, "confirmPassword", errors.confirmPassword)} type="password" required maxLength={128} autoComplete="new-password" />{fieldError("confirmPassword")}</label>
          </>}
        </>}
        <button className={styles.submit} disabled={busy} type="submit">{busy ? "Please wait…" : verifyEmail || !mobile ? "Sign in" : "Send email verification code"} <ArrowRight size={16} aria-hidden="true" /></button>
      </>}
      {notice && <p className={styles.completionNotice} role="status">{notice}</p>}
      {message && <small role="alert">{message}</small>}
    </form>
  </dialog>;
}
