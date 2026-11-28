"use client";

import {useEffect, useRef, useState, type FormEvent} from "react";
import {Flag, X} from "lucide-react";
import CircularProgress from "@mui/material/CircularProgress";
import {propertyReportReasons, type PropertyReportReason} from "@the-property-pillar/contracts";
import toast from "react-hot-toast";
import {apiRequest} from "@/lib/api/client";
import {useMarketplaceAuth} from "@/features/auth/marketplace-session";
import styles from "./directory.module.css";

export function PropertyReport({id}: {id: string}) {
  const auth = useMarketplaceAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef("");
  const pending = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState<PropertyReportReason>();
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !reason) return;
    const details = String(new FormData(event.currentTarget).get("details") ?? "").trim();
    if (reason === "OTHER" && details.length < 3) {setError("Please describe the issue."); return;}
    setError(""); pending.current = true; setBusy(true);
    try {
      const result = await apiRequest<{exists:boolean}>("/public/properties/" + encodeURIComponent(id) + "/reports", {
        method:"POST", body:{reason, details, requestId:requestId.current},
      });
      toast.success(result.exists ? "This report has already been received." : "Report sent to the admin team.");
      dialog.current?.close();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not send report. Please retry.");
    } finally {pending.current = false; setBusy(false);}
  }
  if (auth?.session?.role === "ADMIN") return null;
  return <section className={styles.reportAction}>
    <button className={styles.secondaryButton} aria-haspopup="dialog" onClick={() => {
      requestId.current = crypto.randomUUID(); setReason(undefined); setError(""); setOpen(true);
    }}><Flag size={16}/> Report listing</button>
    {open && <dialog ref={dialog} className={styles.enquiryDialog} aria-label="Report listing"
      onCancel={event => {if (pending.current) event.preventDefault();}} onClose={() => setOpen(false)}>
      <div className={styles.enquiryPanel}>
        <header className={styles.enquiryHeading}><h2>Report listing</h2><button type="button" className={styles.enquiryClose} disabled={busy} aria-label="Close report" onClick={() => dialog.current?.close()}><X size={20}/></button></header>
        <form className={styles.enquiryForm} onSubmit={submit}>
          <fieldset className={styles.reportChips} disabled={busy}><legend>Reason for reporting</legend>
            {Object.entries(propertyReportReasons).map(([key,label]) => <label key={key}>
              <input type="radio" name="reason" required checked={key === reason} onChange={() => setReason(key as PropertyReportReason)}/><span>{label}</span>
            </label>)}
          </fieldset>
          <label>Details{reason !== "OTHER" && " (optional)"}<textarea name="details" rows={4} maxLength={2000} required={reason === "OTHER"} disabled={busy}/></label>
          {error && <p role="alert">{error}</p>}
          <button type="submit" className={styles.primaryButton} disabled={busy} aria-busy={busy}>
            {busy && <CircularProgress size={16} color="inherit"/>}{busy ? "Sending report…" : "Report"}
          </button>
        </form>
      </div>
    </dialog>}
  </section>;
}
