"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useMarketplaceAuth } from "@/features/auth/marketplace-session";
import { loginHref } from "@/features/auth/login-return";
import { apiRequest } from "@/lib/api/client";
import styles from "./projects.module.css";
export function ProjectReport({
  id,
  locale,
  slug,
}: {
  id: string;
  locale: string;
  slug: string;
}) {
  const auth = useMarketplaceAuth(),
    key = useRef(""),
    pending = useRef(false);
  const [sent, setSent] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (auth?.session?.role === "ADMIN") return null;
  return (
    <details className={styles.panel} id="report">
      <summary>Report project</summary>
      {sent ? (
        <p role="status">Your report has been sent to the Admin team.</p>
      ) : !auth?.session ? (
        <Link
          href={loginHref(
            locale,
            "/" + locale + "/projects/" + slug + "#report",
          )}
        >
          Sign in to report a problem
        </Link>
      ) : (
        <form
          className={styles.fields}
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending.current) return;
            pending.current = true;
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              key.current ||= crypto.randomUUID();
              await apiRequest("/public/new-projects/" + id + "/reports", {
                method: "POST",
                body: {
                  reason: f.get("reason"),
                  details: f.get("details"),
                  requestId: key.current,
                },
              });
              setSent(true);
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Unable to submit report.",
              );
            } finally {
              pending.current = false;
              setBusy(false);
            }
          }}
        >
          <label>
            Reason
            <select name="reason" required defaultValue="">
              <option value="">Select reason</option>
              {[
                "Incorrect information",
                "Wrong price",
                "Misleading media",
                "Regulatory issue",
                "Project status incorrect",
                "Duplicate",
                "Other",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Details
            <textarea name="details" required minLength={3} maxLength={2000} />
          </label>
          {error && <p role="alert">{error}</p>}
          <button disabled={busy}>Send report</button>
        </form>
      )}
    </details>
  );
}
