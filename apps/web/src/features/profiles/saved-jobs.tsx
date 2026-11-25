"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api/client";
import styles from "./profiles.module.css";
type Job = { id: string; title: string; status: string };
export function SavedJobs({ locale }: { locale: string }) {
  const [jobs, setJobs] = useState<Job[]>([]),
    [saved, setSaved] = useState<Job[]>([]),
    [error, fail] = useState(""),
    [busy, setBusy] = useState(true),
    [v, reload] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setBusy(true);
    Promise.all([
      apiRequest<Job[]>("/profiles/saved-jobs", { signal: c.signal }),
      apiRequest<Job[]>("/public/jobs?limit=20", { signal: c.signal }),
    ])
      .then(([list, open]) => {
        setSaved(list);
        setJobs(open);
        fail("");
      })
      .catch((e) => {
        if (!c.signal.aborted) fail(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(false);
      });
    return () => c.abort();
  }, [v]);
  async function toggle(id: string, remove: boolean) {
    setBusy(true);
    try {
      await apiRequest("/profiles/saved-jobs/" + encodeURIComponent(id), {
        method: remove ? "DELETE" : "PUT",
      });
      reload((i) => i + 1);
    } catch (e) {
      fail(e instanceof Error ? e.message : "Save failed");
      setBusy(false);
    }
  }
  function row(j: Job, remove: boolean) {
    return (
      <article key={j.id}>
        {j.status === "PUBLISHED" ? (
          <Link href={"/" + locale + "/jobs/" + j.id}>{j.title}</Link>
        ) : (
          <strong>{j.title} (closed)</strong>
        )}{" "}
        <button disabled={busy} onClick={() => void toggle(j.id, remove)}>
          {remove ? "Remove" : "Save job"}
        </button>
      </article>
    );
  }
  return (
    <section className={styles.panel}>
      <h1>Saved jobs</h1>
      {error && <p role="alert">{error}</p>}
      {busy && <p aria-live="polite">Loading...</p>}
      <div className={styles.list}>{saved.map((j) => row(j, true))}</div>
      {!busy && !saved.length && <p>No saved jobs yet.</p>}
      <h2>Open jobs</h2>
      <div className={styles.list}>
        {jobs
          .filter((j) => !saved.some((s) => s.id === j.id))
          .map((j) => row(j, false))}
      </div>
      <Link href={"/" + locale + "/jobs"}>Find jobs</Link>
    </section>
  );
}
