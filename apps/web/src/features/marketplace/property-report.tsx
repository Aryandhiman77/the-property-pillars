"use client";

import {MaterialSelect, MaterialTextarea} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";

import {useEffect, useId, useRef, useState, type FormEvent} from "react";
import {Flag, X} from "lucide-react";
import {propertyReportReasons} from "@the-property-pillar/contracts";
import toast from "react-hot-toast";
import {useMarketplaceAuth} from "@/features/auth/marketplace-session";
import {propertyEnquiryHref} from "@/config/public-tasks";
import {ApiClientError, apiRequest} from "@/lib/api/client";
import {fieldAttributes, invalidControls} from "@/lib/form-validation";
import styles from "./directory.module.css";

export function PropertyReport({id, locale}: {id: string; locale: string}) {
  const auth = useMarketplaceAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const path = "/public/properties/" + encodeURIComponent(id) + "/reports";
  const session = auth?.session;

  useEffect(() => {
    if (!open) return;
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!session) return;
    const abort = new AbortController();
    void apiRequest<{eligible: boolean}>(path + "/eligibility", {signal: abort.signal})
      .then((result) => {if (!abort.signal.aborted) setEligible(result.eligible);},
        (failure: Error) => {if (!abort.signal.aborted) setError(failure.message);});
    return () => abort.abort();
  }, [open, path, session]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eligible || busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const issues = invalidControls(form);
    const details = String(values.get("details") ?? "").trim();
    if (details.length < 3) issues.details = "Describe the issue with this listing.";
    setFields(issues); setError("");
    if (Object.keys(issues).length) return;
    setBusy(true);
    try {
      const result = await apiRequest<{exists: boolean}>(path, {method: "POST", body: {reason: values.get("reason"), details}});
      toast.success(result.exists ? "You already reported this listing." : "Report sent to the admin team.");
      dialog.current?.close();
    } catch (failure) {
      if (failure instanceof ApiClientError && Object.keys(failure.fieldErrors).length) setFields(failure.fieldErrors);
      else setError(failure instanceof Error ? failure.message : "Could not report this listing.");
    } finally {setBusy(false);}
  }
  const issue = (field: string) => fields[field] && <small className={styles.enquiryFieldError} id={prefix + "-" + field} role="alert">{fields[field]}</small>;

  if (session?.role === "ADMIN") return null;
  return <div className={styles.reportAction}>
    <MuiButton type="button" className={styles.secondaryButton} aria-haspopup="dialog" disabled={auth?.state === "loading"} onClick={() => {
      setEligible(null); setError(""); setFields({}); setOpen(true);
    }}><Flag size={16} aria-hidden="true" /> Report listing</MuiButton>
    {open && <dialog ref={dialog} aria-label="Report listing" className={styles.enquiryDialog}
      onClose={() => setOpen(false)} onCancel={(event) => {if (busy) event.preventDefault();}}>
      <div className={styles.enquiryPanel}>
        <MuiButton className={styles.enquiryClose} disabled={busy} type="button" aria-label="Close report" onClick={() => dialog.current?.close()}><X size={19} /></MuiButton>
        <h2>Report listing</h2>
        {eligible ? <form className={styles.enquiryForm} onSubmit={submit} noValidate>
          <label><span>Reason</span><MaterialSelect {...fieldAttributes(prefix, "reason", fields.reason)} required defaultValue="">
            <option value="">Select a reason</option>{Object.entries(propertyReportReasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </MaterialSelect>{issue("reason")}</label>
          <label><span>Details</span><MaterialTextarea {...fieldAttributes(prefix, "details", fields.details)} required minLength={3} maxLength={2000} rows={4} />{issue("details")}</label>
          <MuiButton variant="contained" type="submit" className={styles.primaryButton} disabled={busy}>{busy ? "Sending…" : "Send report"}</MuiButton>
        </form> : !session || eligible === false ? <>
          <p>Send an enquiry for this property to report the listing.</p>
          <a className={styles.primaryButton} href={propertyEnquiryHref(locale, id)}>Send an enquiry</a>
        </> : !error ? <p role="status">Checking report access…</p> : null}
        {error && <p className={styles.enquiryError} role="alert">{error}</p>}
      </div>
    </dialog>}
  </div>;
}
