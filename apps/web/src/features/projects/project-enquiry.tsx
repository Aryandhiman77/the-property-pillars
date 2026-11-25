"use client";

import {MaterialInput, MaterialSelect, MaterialTextarea} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";
import type {LeadVisitorType} from "@the-property-pillar/contracts";
import {useMobilePrompt, VisitorOptions} from "@/features/auth/mobile-auth";
import { useId, useRef, useState, type FormEvent } from "react";
import { apiRequest, ApiClientError } from "@/lib/api/client";
import { PhoneInput, formPhone } from "@/components/ui/phone-input";
import { usePropertyContactProfile } from "@/features/marketplace/property-contact-profile";
import styles from "./projects.module.css";

export function ProjectEnquiry({
  id,
  locale,
  configurations,
  contactMethod,
  initialConfiguration,
}: {
  id: string;
  slug: string;
  locale: string;
  configurations: { id: string; name: string }[];
  contactMethod?: string;
  initialConfiguration?: string;
}) {
  const uid = useId(),
    request = useRef(""),
    pending = useRef(false);
  const [type, setType] = useState(
      initialConfiguration
        ? "CONFIGURATION"
        : contactMethod === "Request callback"
          ? "CALLBACK"
          : contactMethod === "Site visit"
            ? "SITE_VISIT"
            : contactMethod === "WhatsApp"
              ? "WHATSAPP"
              : "PROJECT",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [whatsappUrl, setWhatsappUrl] = useState<string>(),
    [sent, setSent] = useState(false);
  const {auth, signedIn, fullName, email, phone} = usePropertyContactProfile(true);
  const mobile = useMobilePrompt();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending.current) return;
    const form = new FormData(e.currentTarget);
    pending.current = true;
    setBusy(true);
    setError("");
    setErrors({});
    try {
      request.current ||= crypto.randomUUID();
      if (!signedIn && !await mobile.verify({scope: "project:" + id, requestId: request.current, identity: {
        fullName: String(form.get("fullName") ?? ""), phone: formPhone(form), visitorType: form.get("visitorType") as LeadVisitorType,
      }})) return;
      const result = await apiRequest<{ id: string; whatsappUrl?: string }>(
        "/public/new-projects/" + id + "/enquiries",
        {
          method: "POST",
          body: {
            requestId: request.current,
            type,
            fullName: form.get("fullName"),
            phone: formPhone(form),
            email: form.get("email") || undefined,
            consent: form.get("consent") === "on",
            locale,
            message: form.get("message"),
            configurationId: form.get("configurationId") || undefined,
            visitAt:
              type === "SITE_VISIT"
                ? new Date(String(form.get("visitAt"))).toISOString()
                : undefined,
          },
        },
      );
      setWhatsappUrl(result.whatsappUrl);
      setSent(true);
      request.current = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send enquiry.");
      if (e instanceof ApiClientError) setErrors(e.fieldErrors);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section id="enquiry" className={styles.panel}>
      <h2>Contact the Builder</h2>
      {auth?.state === "loading" ? (
        <p aria-busy="true">Loading your contact details…</p>
      ) : auth?.session?.role === "ADMIN" ? (
        <p>Project enquiries are available to marketplace members.</p>
      ) : sent ? (
        <div role="status">
          <p>Your enquiry was sent to the Builder.</p>
          {whatsappUrl && (
            <a href={whatsappUrl} target="_blank" rel="noreferrer">
              Continue on WhatsApp
            </a>
          )}
          <MuiButton type="submit" onClick={() => setSent(false)}>Send another enquiry</MuiButton>
        </div>
      ) : (
        <form onSubmit={submit} className={styles.fields}>
          <label>
            Enquiry type
            <MaterialSelect value={type} onChange={(e) => setType(e.target.value)}>
              <option value="PROJECT">Project enquiry</option>
              {configurations.length > 0 && (
                <option value="CONFIGURATION">Configuration enquiry</option>
              )}
              {contactMethod === "WhatsApp" && (
                <option value="WHATSAPP">Contact on WhatsApp</option>
              )}
              <option value="CALLBACK">Request a callback</option>
              <option value="SITE_VISIT">Schedule a site visit</option>
            </MaterialSelect>
          </label>
          {(type === "CONFIGURATION" ||
            (type === "SITE_VISIT" && configurations.length > 0)) && (
            <label>
              Configuration
              <MaterialSelect
                name="configurationId"
                required={type === "CONFIGURATION"}
                defaultValue={initialConfiguration}
              >
                <option value="">Choose configuration</option>
                {configurations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </MaterialSelect>
              <small>{errors.configurationId}</small>
            </label>
          )}
          {type === "SITE_VISIT" && (
            <label>
              Preferred date and time
              <MaterialInput type="datetime-local" required name="visitAt" />
              <small>{errors.visitAt}</small>
            </label>
          )}
          <label>
            Full name
            <MaterialInput
              name="fullName"
              defaultValue={fullName}
              required
              maxLength={160}
            />
            <small>{errors.fullName}</small>
          </label>
          <label>Email address<MaterialInput name="email" type="email" autoComplete="email" defaultValue={email} />
            <small>{errors.email}</small></label>
          {!signedIn && <label>Which best describes you?<MaterialSelect name="visitorType" defaultValue="" required><VisitorOptions /></MaterialSelect></label>}
          <div>
            <label htmlFor={uid}>Mobile number</label>
            <PhoneInput
              id={uid}
              key={phone}
              name="phone"
              defaultValue={phone}
              required
            />
            <small>{errors.phone}</small>
          </div>
          <label>
            Message
            <MaterialTextarea name="message" maxLength={1000} />
          </label>
          <label className={styles.check}>
            <MaterialInput name="consent" type="checkbox" required />
            Share my details with the project’s Builder
          </label>
          {error && <p role="alert">{error}</p>}
          <MuiButton variant="contained" type="submit" disabled={busy}>{busy ? "Sending…" : "Send enquiry"}</MuiButton>
        </form>
      )}
      {mobile.dialog}
    </section>
  );
}
