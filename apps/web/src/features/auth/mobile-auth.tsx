"use client";

import {useEffect, useId, useRef, useState, type FormEvent} from "react";
import {Smartphone, X} from "lucide-react";
import {leadVisitorLabels, leadVisitorTypes, normalizeContactPhone, type LeadVisitorType} from "@the-property-pillar/contracts";
import {PhoneInput, formPhone} from "@/components/ui/phone-input";
import {ApiClientError, apiRequest} from "@/lib/api/client";
import {Button} from "@/components/ui/button";
import {AccountCompletionDialog, type CompletionRole, type MobileOnboarding} from "./account-completion-dialog";
import styles from "./mobile-auth.module.css";

export type MobileIdentity = {phone: string; fullName: string; visitorType: LeadVisitorType};
type Prompt = {scope?: string; identity?: Partial<MobileIdentity>; roles?: CompletionRole[]; mode?: "register" | "sign-in" | "profile"; close: (result: MobileIdentity | true | null) => void};
type Challenge = {challengeId: string; developmentCode?: string; expiresIn: number};

export function VisitorOptions() {
  return <><option value="">Select an option</option>{leadVisitorTypes.map((key) => <option key={key} value={key}>{leadVisitorLabels[key]}</option>)}</>;
}

function MobileDialog({scope, identity, roles = [], mode = "register", close}: Prompt) {
  const formId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const running = useRef(false);
  const [working, setWorking] = useState(false);
  const [challenge, setChallenge] = useState<Challenge>();
  const [cooldown, setCooldown] = useState(0);
  const [profile, setProfile] = useState<Partial<MobileIdentity>>(identity ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [onboarding, setOnboarding] = useState<MobileOnboarding>();
  const register = mode === "register";
  const collected = Boolean(identity?.phone && identity.fullName && identity.visitorType);
  useEffect(() => {if (!onboarding) dialog.current?.showModal();}, [onboarding]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function perform(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setWorking(true); setMessage(""); setErrors({});
    try {await action();}
    catch (failure) {
      if (failure instanceof ApiClientError && Object.keys(failure.fieldErrors).length) {
        setErrors(Object.fromEntries(Object.entries(failure.fieldErrors).map(([key, value]) => [key.replace(/^registration\./, ""), value])));
      } else setMessage(failure instanceof Error ? failure.message : "Verification could not be completed.");
    } finally {running.current = false; setWorking(false);}
  }

  async function send(next: Partial<MobileIdentity>) {
    const invalid: Record<string, string> = {};
    const phone = normalizeContactPhone(next.phone ?? "");
    if (!phone?.startsWith("+")) invalid.phone = "Enter your mobile number with country code.";
    if (register && (next.fullName?.trim().length ?? 0) < 2) invalid.fullName = "Enter your full name.";
    if (register && !next.visitorType) invalid.visitorType = "Choose an option.";
    if (Object.keys(invalid).length) {setErrors(invalid); return;}
    setProfile({...next, phone});
    await perform(async () => {
      const result = await apiRequest<Challenge>("/auth/mobile/start", {method: "POST", body: {
        phone, ...(register ? {registration: {fullName: next.fullName, visitorType: next.visitorType, scope}} : {}),
        ...(mode === "profile" ? {profile: true} : {}),
      }});
      setChallenge(result);
      setCooldown(60);
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    if (!challenge) {
      void send(collected ? profile : {...profile, phone: formPhone(values) || profile.phone,
        ...(register ? {fullName: String(values.get("fullName") ?? profile.fullName ?? "").trim(), visitorType: String(values.get("visitorType") ?? "") as LeadVisitorType} : {})});
      return;
    }
    if (!/^\d{6}$/.test(String(values.get("code") ?? ""))) {
      setErrors({code: "Enter the six-digit verification code."});
      return;
    }
    void perform(async () => {
      const result = await apiRequest<{onboarding?: MobileOnboarding}>("/auth/mobile/verify", {method: "POST", body: {challengeId: challenge.challengeId, code: values.get("code")}});
      if (result.onboarding) setOnboarding(result.onboarding);
      else close(register ? profile as MobileIdentity : true);
    });
  }
  if (onboarding) return <AccountCompletionDialog info={onboarding} roles={roles} finish={() => close(true)} restart={() => {
    setChallenge(undefined);
    setOnboarding(undefined);
    setErrors({});
    setMessage("");
  }} />;
  const errorId = (field: string) => errors[field] ? `${formId}-${field}-error` : undefined;
  const fieldError = (field: string) => errors[field] && <small role="alert" id={errorId(field)}>{errors[field]}</small>;
  return <dialog className={styles.dialog} ref={dialog} aria-labelledby={`${formId}-title`} onCancel={(event) => {event.preventDefault(); if (!working) close(null);}}>
    <form onSubmit={submit} className={styles.form} noValidate aria-busy={working}>
      <header>
        <span className={styles.icon}><Smartphone size={20} aria-hidden="true" /></span>
        <div><h2 id={`${formId}-title`}>{mode === "sign-in" ? "Continue with mobile" : "Verify your mobile number"}</h2>
          {!challenge && !collected && <p>{mode === "sign-in" ? "Verify your number to sign in or create an account." : "We’ll send a six-digit verification code."}</p>}
        </div>
        <button type="button" disabled={working} aria-label="Close mobile verification" onClick={() => close(null)}><X size={19} aria-hidden="true" /></button>
      </header>
      {!challenge ? <>
        {register && !collected && <label>Full name<input name="fullName" autoComplete="name" defaultValue={profile.fullName} aria-invalid={!!errors.fullName} aria-describedby={errorId("fullName")} maxLength={100} />{fieldError("fullName")}</label>}
        {collected ? <p>Send a verification code to <bdi>{profile.phone}</bdi>.</p> :
          <div className={styles.phoneField}>
            <label htmlFor={`${formId}-phone`}>Mobile number</label>
            <PhoneInput id={`${formId}-phone`} className={styles.input} name="phone" placeholder="Enter mobile number" defaultValue={profile.phone}
              autoFocus={!register} required aria-invalid={!!errors.phone} aria-describedby={errorId("phone")} />
            {fieldError("phone")}
          </div>}
        {register && !collected && <label>Which best describes you?<select name="visitorType" defaultValue={profile.visitorType ?? ""} aria-invalid={!!errors.visitorType} aria-describedby={errorId("visitorType")}><VisitorOptions /></select>{fieldError("visitorType")}</label>}
        {collected && <>{fieldError("phone")}{fieldError("fullName")}{fieldError("visitorType")}</>}
      </> : <>
        <p>Enter the six-digit code for <bdi>{profile.phone}</bdi>.</p>
        {challenge.developmentCode && <p className={styles.code} role="status">Development code <strong>{challenge.developmentCode}</strong></p>}
        <label>Verification code<input autoFocus name="code" placeholder="Enter 6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-invalid={!!errors.code} aria-describedby={errorId("code")} />{fieldError("code")}</label>
        <div className={styles.actions}>
          <button type="button" disabled={working} onClick={() => {setChallenge(undefined); setErrors({}); setMessage("");}}>Back</button>
          <button type="button" disabled={working || cooldown > 0} onClick={() => void send(profile)}>{cooldown ? `Resend in ${cooldown}s` : "Resend code"}</button>
        </div>
      </>}
      {message && <small role="alert">{message}</small>}
      <Button className={styles.submit} type="submit" disabled={working}>{working ? "Please wait…" : challenge ? "Verify and continue" : "Send verification code"}</Button>
    </form>
  </dialog>;
}

export function useMobilePrompt() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const active = useRef<Prompt | null>(null);
  useEffect(() => () => {active.current?.close(null);}, []);
  function verify(options: Omit<Prompt, "close">) {
    return new Promise<MobileIdentity | true | null>((resolve) => {
      if (active.current) {resolve(null); return;}
      const request: Prompt = {...options, close: (result) => {active.current = null; setPrompt(null); resolve(result);}};
      active.current = request;
      setPrompt(request);
    });
  }
  return {verify, dialog: prompt && <MobileDialog {...prompt} />};
}
