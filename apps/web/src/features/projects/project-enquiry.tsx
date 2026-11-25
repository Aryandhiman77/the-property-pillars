"use client";
import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { apiRequest, ApiClientError } from "@/lib/api/client";
import { loginHref } from "@/features/auth/login-return";
import { PhoneInput, formPhone } from "@/components/ui/phone-input";
import { usePropertyContactProfile } from "@/features/marketplace/property-contact-profile";
import styles from "./projects.module.css";

export function ProjectEnquiry({
  id,
  slug,
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
  const { auth, signedIn, fullName, phone } = usePropertyContactProfile(true);
  const next =
    "/" +
    locale +
    "/projects/" +
    slug +
    (initialConfiguration
      ? "?configuration=" + encodeURIComponent(initialConfiguration)
      : "") +
    "#enquiry";
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
      const result = await apiRequest<{ id: string; whatsappUrl?: string }>(
        "/public/new-projects/" + id + "/enquiries",
        {
          method: "POST",
          body: {
            requestId: request.current,
            type,
            fullName: form.get("fullName"),
            phone: formPhone(form),
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
      ) : !signedIn ? (
        <Link href={loginHref(locale, next)}>
          Sign in to enquire or schedule a visit
        </Link>
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
          <button onClick={() => setSent(false)}>Send another enquiry</button>
        </div>
      ) : (
        <form onSubmit={submit} className={styles.fields}>
          <label>
            Enquiry type
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="PROJECT">Project enquiry</option>
              {configurations.length > 0 && (
                <option value="CONFIGURATION">Configuration enquiry</option>
              )}
              {contactMethod === "WhatsApp" && (
                <option value="WHATSAPP">Contact on WhatsApp</option>
              )}
              <option value="CALLBACK">Request a callback</option>
              <option value="SITE_VISIT">Schedule a site visit</option>
            </select>
          </label>
          {(type === "CONFIGURATION" ||
            (type === "SITE_VISIT" && configurations.length > 0)) && (
            <label>
              Configuration
              <select
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
              </select>
              <small>{errors.configurationId}</small>
            </label>
          )}
          {type === "SITE_VISIT" && (
            <label>
              Preferred date and time
              <input type="datetime-local" required name="visitAt" />
              <small>{errors.visitAt}</small>
            </label>
          )}
          <label>
            Full name
            <input
              name="fullName"
              defaultValue={fullName}
              required
              maxLength={160}
            />
            <small>{errors.fullName}</small>
          </label>
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
            <textarea name="message" maxLength={1000} />
          </label>
          <label className={styles.check}>
            <input name="consent" type="checkbox" required />
            Share my details with the project’s Builder
          </label>
          {error && <p role="alert">{error}</p>}
          <button disabled={busy}>{busy ? "Sending…" : "Send enquiry"}</button>
        </form>
      )}
    </section>
  );
}
