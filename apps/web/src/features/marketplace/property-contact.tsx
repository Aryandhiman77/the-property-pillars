"use client";

import {CheckCircle2, MessageCircle, Phone, Send, X} from "lucide-react";
import {leadVisitorTypes, normalizeContactPhone, type LeadVisitorType} from "@the-property-pillar/contracts";
import {useTranslations} from "next-intl";
import {useEffect, useId, useRef, useState, type FormEvent} from "react";
import toast from "react-hot-toast";
import {ApiClientError, apiRequest} from "@/lib/api/client";
import {clearChangedField, fieldAttributes, focusInvalidControl, invalidControls, splitFieldErrors, type FieldErrors} from "@/lib/form-validation";
import {PhoneInput, formPhone} from "@/components/ui/phone-input";
import {useMobilePrompt, VisitorOptions} from "@/features/auth/mobile-auth";
import {usePropertyContactProfile} from "./property-contact-profile";
import styles from "./directory.module.css";

const fields = ["fullName", "phone", "visitorType","visitAt","message"] as const;

export function PropertyContact({id, locale, masked, row, inline = false}: {id: string; locale: string; masked?: string; row?: boolean; inline?: boolean}) {
  const t = useTranslations("Site");
  const labels = useTranslations("PropertyContact");
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef("");
  const pending = useRef(false);
  const mobile = useMobilePrompt();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [visit,setVisit]=useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const {auth, signedIn, fullName, phone: profilePhone} = usePropertyContactProfile(inline || open);
  const loading = auth?.state === "loading";
  const canEnquire = auth?.session?.role !== "ADMIN";
  const path = "/public/properties/" + encodeURIComponent(id);

  useEffect(() => {
    if (loading || !canEnquire) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("enquire") !== id) return;
    url.searchParams.delete("enquire");
    window.history.replaceState(null, "", url);
    if (inline) {
      formRef.current?.scrollIntoView({block: "nearest"});
      formRef.current?.querySelector("input")?.focus({preventScroll: true});
    } else {
      requestId.current = window.crypto.randomUUID();
      setOpen(true);
    }
  }, [id, loading, canEnquire, inline]);

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);

  useEffect(() => {
    if (auth?.state === "guest") {
      setPhone("");
      setSubmitted(false);
      setNotice("");
    }
  }, [auth?.state]);

  function openForm() {
    setError("");
    setFieldErrors({});
    if (inline) {
      setNotice(t("contactNeedsEnquiry"));
      formRef.current?.scrollIntoView({block: "nearest"});
      formRef.current?.querySelector("input")?.focus({preventScroll: true});
    } else {
      requestId.current = window.crypto.randomUUID();
      setOpen(true);
    }
  }

  async function loadNumber() {
    if (!signedIn) {openForm(); return;}
    setChecking(true);
    setNotice("");
    try {
      const result = await apiRequest<{phone: string}>(path + "/contact");
      setPhone(result.phone);
    } catch (cause) {
      if (cause instanceof ApiClientError && [401, 404].includes(cause.status)) openForm();
      else setNotice(t("contactLoadError"));
    } finally {
      setChecking(false);
    }
  }

  async function sendEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || (inline && submitted)) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get("fullName") ?? "").trim();
    const contactPhone = normalizeContactPhone(formPhone(values));
    const visitorType = values.get("visitorType") as LeadVisitorType;
    const invalid = invalidControls(form);
    if(visit && !(new Date(String(values.get("visitAt"))).getTime()>Date.now()))invalid.visitAt="Choose a future date and time.";
    if (name.length < 2) invalid.fullName = t("enquiryNameRequired");
    if (!contactPhone) invalid.phone = t("enquiryMobileInvalid");
    if (!signedIn && !leadVisitorTypes.includes(visitorType)) invalid.visitorType = labels("chooseVisitorType");
    setFieldErrors(invalid);
    setError("");
    if (Object.keys(invalid).length) {
      focusInvalidControl(form);
      return;
    }
    requestId.current ||= window.crypto.randomUUID();
    pending.current = true;
    setSending(true);
    let verified = false;
    try {
      if (!signedIn) {
        verified = Boolean(await mobile.verify({scope: "property:" + id, identity: {fullName: name, phone: contactPhone!, visitorType}}));
        if (!verified) return;
      }
      const result = await apiRequest<{phone?: string}>(path + "/enquiries", {method: "POST", body: {
        requestId: requestId.current, locale, fullName: name, phone: contactPhone,...(visit?{visitAt:new Date(String(new FormData(form).get("visitAt"))).toISOString(),message:String(new FormData(form).get("message")??"")}:{}) ,
      }});
      if (result.phone) setPhone(result.phone);
      if (inline) setSubmitted(true);
      setNotice("");
      toast.success(t("propertyEnquirySent"));
      dialog.current?.close();
    } catch (cause) {
      if (cause instanceof ApiClientError && Object.keys(cause.fieldErrors).length) {
        const {fields: byField, general} = splitFieldErrors(cause.fieldErrors, fields);
        setFieldErrors(byField);
        setError(general);
        focusInvalidControl(form);
      } else setError(cause instanceof Error ? cause.message : t("propertyEnquiryFailed"));
    } finally {
      if (verified) void auth?.refresh();
      pending.current = false;
      setSending(false);
    }
  }

  function fieldError(field: (typeof fields)[number]) {
    return fieldErrors[field] && <small className={styles.enquiryFieldError} id={formId + "-" + field} role="alert">{fieldErrors[field]}</small>;
  }

  const revealed = signedIn ? phone : "";
  const canViewContact = Boolean(masked) && !revealed && canEnquire && (!inline || !submitted);
  const number = revealed && <a className={styles.contactNumber} href={"tel:" + revealed} aria-label={t("callListingContact") + " " + revealed}><Phone size={17} aria-hidden="true" /><bdi>{revealed}</bdi></a>;
  const actions = <div className={styles.contactActions}>
    {canViewContact && <button type="button" className={`${styles.secondaryButton}${row ? ` ${styles.viewNumber}` : ""}`}
      aria-controls={inline && !loading ? formId : undefined} aria-haspopup={!inline ? "dialog" : undefined}
      disabled={checking || loading || sending} onClick={() => void loadNumber()}>
      {row && <Phone size={15} aria-hidden="true" />}
      {checking ? t("loadingListingNumber") : row ? t("viewListingNumber") : labels("viewContact")}
    </button>}
    {!inline && canEnquire && <button type="button" className={`${styles.primaryButton} ${styles.contactListing}`} aria-haspopup="dialog" disabled={loading} onClick={openForm}>
      <MessageCircle size={16} aria-hidden="true" />{t("contactListing")}
    </button>}
  </div>;
  const form = <form ref={formRef} className={styles.enquiryForm} id={formId} noValidate aria-busy={sending}
    onSubmit={sendEnquiry} onChange={(event) => clearChangedField(event, setFieldErrors)}>
    <label>
      <span>{t("fullName")}</span>
      <input {...fieldAttributes(formId, "fullName", fieldErrors.fullName)} required autoComplete="name" maxLength={100}
        defaultValue={fullName} disabled={sending} />
      {fieldError("fullName")}
    </label>
    <div className={styles.enquiryPhone}>
      <label htmlFor={formId + "-phone-input"}>{t("enquiryMobileNumber")}</label>
      <PhoneInput {...fieldAttributes(formId, "phone", fieldErrors.phone)} name="phone" id={formId + "-phone-input"}
        required defaultValue={profilePhone} disabled={sending} />
      {fieldError("phone")}
    </div>
    <label><input type="checkbox" checked={visit} onChange={e=>setVisit(e.target.checked)}/>Request a site visit</label>{visit&&<><label>Preferred date and time<input type="datetime-local" name="visitAt" required/>{fieldError("visitAt")}</label><label>Message<textarea name="message" maxLength={1000}/>{fieldError("message")}</label></>}
    {!signedIn && <label>
      <span>{labels("visitorType")}</span>
      <select {...fieldAttributes(formId, "visitorType", fieldErrors.visitorType)} defaultValue="" required disabled={sending}>
        <VisitorOptions />
      </select>
      {fieldError("visitorType")}
    </label>}
    <small>{labels("sharing")}</small>
    <button type="submit" className={styles.primaryButton} disabled={sending || loading}>
      <Send size={16} aria-hidden="true" />{sending ? t("saving") : t("sendPropertyEnquiry")}
    </button>
    {error && <p className={styles.enquiryError} role="alert">{error}</p>}
  </form>;

  return <div className={row ? styles.rowContact : styles.propertyContact}>
    {inline ? <>
      <div className={styles.phoneSummary}>
        {number || (masked
          ? <p className={styles.contactNumber}><Phone size={17} aria-hidden="true" /><bdi>{masked.replaceAll("•", "*")}</bdi></p>
          : <p className={styles.noContactNumber}>{labels("noNumber")}</p>)}
        {canViewContact && actions}
      </div>
      {notice && <small role="status">{notice}</small>}
      {canEnquire && <section className={styles.inlineEnquiry} aria-labelledby={formId + "-heading"}>
        <h3 id={formId + "-heading"}>{t("enquireAboutProperty")}</h3>
        {loading && !sending ? <p role="status">{t("checkingListingAccount")}</p>
          : submitted ? <p className={styles.enquirySuccess} role="status"><CheckCircle2 size={18} aria-hidden="true" />{t("propertyEnquirySent")}</p>
            : form}
      </section>}
    </> : <>
      {number}
      {actions}
      {!open && notice && <small role="status">{notice}</small>}
    </>}
    {open && <dialog ref={dialog} className={styles.enquiryDialog} aria-label={t("enquireAboutProperty")}
      onClose={() => setOpen(false)} onCancel={(event) => {if (sending) event.preventDefault();}}
      onClick={(event) => {if (!sending && event.target === event.currentTarget) dialog.current?.close();}}>
      <div className={styles.enquiryPanel}>
        <button type="button" className={styles.enquiryClose} aria-label={t("close")} disabled={sending} onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button>
        {form}
      </div>
    </dialog>}
    {mobile.dialog}
  </div>;
}
