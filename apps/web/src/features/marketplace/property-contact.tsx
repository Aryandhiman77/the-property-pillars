"use client";

import {MaterialInput, MaterialSelect, MaterialTextarea} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";

import {CheckCircle2, Images, MessageCircle, Phone, Send, X} from "lucide-react";
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

const fields = ["fullName", "email", "phone", "visitorType", "visitAt", "message", "consentAccepted"] as const;

export function PropertyContact({id, locale, masked, row, inline = false, photos = false, contactRole, photoKind = "properties", professionalTitle}: {id: string; locale: string; masked?: string; row?: boolean; inline?: boolean; photos?: boolean; contactRole?: string; professionalTitle?: string; photoKind?: "properties" | "professionals" | "materials" | "projects"}) {
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
  const {auth, signedIn, fullName, email, phone: profilePhone} = usePropertyContactProfile(inline || open);
  const loading = auth?.state === "loading";
  const canEnquire = auth?.session?.role !== "ADMIN";
  const subject = {properties: "property", professionals: "portfolio", materials: "product", projects: "project"}[photoKind];
  const enquiryTitle = professionalTitle ? `Enquire with ${professionalTitle}` : photos ? `Request ${subject} photos` : t("enquireAboutProperty");
  const successTitle = professionalTitle ? "Enquiry sent" : photos ? "Photo request sent" : t("propertyEnquirySent");
  const directoryPhoto = photoKind === "professionals" || photoKind === "materials";
  const path = "/public/properties/" + encodeURIComponent(id);

  useEffect(() => {
    if (photos || loading || !canEnquire) return;
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
  }, [id, loading, canEnquire, inline, photos]);

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
    if (pending.current || submitted || loading || !canEnquire) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get("fullName") ?? "").trim();
    const contactPhone = normalizeContactPhone(formPhone(values));
    const visitorType = values.get("visitorType") as LeadVisitorType;
    const invalid = invalidControls(form);
    const message = String(values.get("message") ?? "").trim();
    if (professionalTitle && !message) invalid.message = "Enter a message for this professional.";
    const visitAt = visit ? new Date(String(values.get("visitAt"))) : undefined;
    if (visitAt && !(visitAt.getTime() > Date.now())) invalid.visitAt = "Choose a future date and time.";
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
    try {
      if (!signedIn) {
        const scope = professionalTitle ? "workspace:serviceInquiries"
          : (directoryPhoto ? "photos:" : photoKind === "projects" ? "project:" : "property:") + id;
        const verified = Boolean(await mobile.verify({scope, requestId: requestId.current, identity: {fullName: name, phone: contactPhone!, visitorType}}));
        if (!verified) return;
      }
      const endpoint = directoryPhoto ? `/public/${photoKind}/${encodeURIComponent(id)}/photo-enquiries`
        : photoKind === "projects" ? "/public/new-projects/" + encodeURIComponent(id) + "/enquiries" : path + "/enquiries";
      const emailAddress = values.get("email") || undefined;
      if (professionalTitle) {
        await apiRequest("/workspace/serviceInquiries", {method: "POST", body: {
          title: professionalTitle,
          requestId: requestId.current,
          locale,
          data: {serviceProfileId: id, fullName: name, phone: contactPhone, email: emailAddress, message,
            consentAccepted: values.get("consentAccepted") === "on"},
        }});
      } else {
        const result = await apiRequest<{phone?: string}>(endpoint, {method: "POST", body: {
          ...(photoKind === "projects" ? {type: "PROJECT", consent: true} : {}),
          requestId: requestId.current,
          locale,
          fullName: name,
          email: emailAddress,
          phone: contactPhone,
          ...(photos ? {message: `Please share ${subject} photos.`} : {}),
          ...(visitAt ? {visitAt: visitAt.toISOString(), message} : {}),
        }});
        setPhone(result.phone ?? "");
      }
      setSubmitted(true);
      setNotice("");
      toast.success(successTitle);
    } catch (cause) {
      if (cause instanceof ApiClientError && Object.keys(cause.fieldErrors).length) {
        const {fields: byField, general} = splitFieldErrors(cause.fieldErrors, fields);
        setFieldErrors(byField);
        setError(general);
        focusInvalidControl(form);
      } else setError(cause instanceof Error ? cause.message : t("propertyEnquiryFailed"));
    } finally {
      pending.current = false;
      setSending(false);
    }
  }

  function fieldError(field: (typeof fields)[number]) {
    return fieldErrors[field] && <small className={styles.enquiryFieldError} id={formId + "-" + field} role="alert">{fieldErrors[field]}</small>;
  }

  const revealed = phone;
  const canViewContact = Boolean(masked) && !revealed && canEnquire && (!inline || !submitted);
  const number = revealed && <a className={styles.contactNumber} href={"tel:" + revealed} aria-label={t("callListingContact") + " " + revealed}><Phone size={17} aria-hidden="true" /><bdi>{revealed}</bdi></a>;
  const actions = <div className={styles.contactActions}>
    {canViewContact && <MuiButton type="button" className={`${styles.secondaryButton}${row ? ` ${styles.viewNumber}` : ""}`}
      aria-controls={inline && !loading ? formId : undefined} aria-haspopup={!inline ? "dialog" : undefined}
      disabled={checking || loading || sending} onClick={() => void loadNumber()}>
      {row && <Phone size={15} aria-hidden="true" />}
      {checking ? t("loadingListingNumber") : row ? t("viewListingNumber") : labels("viewContact")}
    </MuiButton>}
    {!inline && canEnquire && <MuiButton type="button" className={`${styles.primaryButton} ${styles.contactListing}`} aria-haspopup="dialog" onClick={openForm}>
      <MessageCircle size={16} aria-hidden="true" />{professionalTitle ? "Enquire" : t("contactListing")}
    </MuiButton>}
  </div>;
  const form = <form ref={formRef} className={styles.enquiryForm} id={formId} noValidate aria-busy={sending}
    onSubmit={sendEnquiry} onChange={(event) => clearChangedField(event, setFieldErrors)}>
    <label>
      <span>{t("fullName")}</span>
      <MaterialInput {...fieldAttributes(formId, "fullName", fieldErrors.fullName)} required autoComplete="name" maxLength={100}
        defaultValue={fullName} disabled={sending} />
      {fieldError("fullName")}
    </label>
    <label><span>{t("email")}</span>
      <MaterialInput {...fieldAttributes(formId, "email", fieldErrors.email)} type="email" autoComplete="email" defaultValue={email} disabled={sending} />
      {fieldError("email")}
    </label>
    <div className={styles.enquiryPhone}>
      <label htmlFor={formId + "-phone-input"}>{t("enquiryMobileNumber")}</label>
      <PhoneInput {...fieldAttributes(formId, "phone", fieldErrors.phone)} name="phone" id={formId + "-phone-input"}
        required defaultValue={profilePhone} disabled={sending} />
      {fieldError("phone")}
    </div>
    {!photos && !professionalTitle && <label><MaterialInput type="checkbox" checked={visit} onChange={e=>setVisit(e.target.checked)}/>Request a site visit</label>}{visit&&<><label>Preferred date and time<MaterialInput type="datetime-local" name="visitAt" required/>{fieldError("visitAt")}</label><label>Message<MaterialTextarea name="message" maxLength={1000}/>{fieldError("message")}</label></>}
    {!signedIn && <label>
      <span>{labels("visitorType")}</span>
      <MaterialSelect {...fieldAttributes(formId, "visitorType", fieldErrors.visitorType)} defaultValue="" required disabled={sending}>
        <VisitorOptions />
      </MaterialSelect>
      {fieldError("visitorType")}
    </label>}
    {professionalTitle ? <>
      <label><span>Message</span>
        <MaterialTextarea {...fieldAttributes(formId, "message", fieldErrors.message)} required maxLength={1000} rows={4} disabled={sending}/>
        {fieldError("message")}
      </label>
      <label className={styles.enquiryConsent}>
        <input {...fieldAttributes(formId, "consentAccepted", fieldErrors.consentAccepted)} type="checkbox" required disabled={sending}/>
        Share my contact details and message with this professional.
      </label>
      {fieldError("consentAccepted")}
    </> : <small>{labels("sharing")}</small>}
    <MuiButton variant="contained" type="submit" className={styles.primaryButton} disabled={sending || loading}>
      <Send size={16} aria-hidden="true" />{sending ? t("saving") : professionalTitle ? "Send enquiry" : photos ? "Send photo request" : t("sendPropertyEnquiry")}
    </MuiButton>
    {error && <p className={styles.enquiryError} role="alert">{error}</p>}
  </form>;

  const confirmation = <div className={styles.photoConfirmation} role="status">
    <CheckCircle2 size={26} aria-hidden="true" />
    <h3>{successTitle}</h3>
    {number ? <><p>Please contact the {contactRole || "listing contact"} at this number{photos ? ` for ${subject} photos` : ""}.</p>{number}</>
      : <p>{professionalTitle ? `${professionalTitle} can reply using the contact details you provided.` : "The advertiser can reply using the contact details you provided."}</p>}
  </div>;
  return <div className={photos ? styles.photoRequestArea : row ? styles.rowContact : styles.propertyContact}>
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
    </> : photos ? (canEnquire ? <button type="button" className={styles.photoRequestButton} aria-haspopup="dialog" onClick={openForm}>
      <Images size={20} aria-hidden="true" />Request photos
    </button> : <span>Photos unavailable</span>) : <>
      {number}
      {actions}
      {!open && notice && <small role="status">{notice}</small>}
    </>}
    {open && <dialog ref={dialog} className={styles.enquiryDialog} aria-label={enquiryTitle}
      onClose={() => setOpen(false)} onCancel={(event) => {if (sending) event.preventDefault();}}
      onClick={(event) => {if (!sending && event.target === event.currentTarget) dialog.current?.close();}}>
      <div className={styles.enquiryPanel}>
        <MuiButton type="button" className={styles.enquiryClose} aria-label={t("close")} disabled={sending} onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></MuiButton>
        {submitted ? confirmation : <>{(photos || professionalTitle) && <h3>{enquiryTitle}</h3>}{form}</>}
      </div>
    </dialog>}
    {mobile.dialog}
  </div>;
}
