"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import { LoadingRows } from "@/components/ui/loading-skeleton";
import styles from "./projects.module.css";
type Summary = {
  activeProjects: number;
  pendingReviews: number;
  newEnquiries: number;
  inventory: { availability: string; _count: number }[];
};
export function ProjectMetrics() {
  const [summary, setSummary] = useState<Summary>(),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    apiRequest<Summary>("/builder-projects/overview", { signal: c.signal })
      .then(setSummary)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!summary) return <LoadingRows label="Loading project metrics" />;
  return (
    <section aria-label="Project metrics" className={styles.panel}>
      <dl className={styles.facts}>
        {Object.entries({
          "Active projects": summary.activeProjects,
          "Available units":
            summary.inventory.find((s) => s.availability === "AVAILABLE")
              ?._count ?? 0,
          "New project enquiries": summary.newEnquiries,
          "Projects awaiting review": summary.pendingReviews,
        }).map(([label, n]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{n}</dd>
          </div>
        ))}
      </dl>
      {summary.inventory.length > 0 && (
        <details>
          <summary>Tracked inventory by availability</summary>
          {summary.inventory.map((s) => (
            <p key={s.availability}>
              {s.availability.replaceAll("_", " ")} · {s._count}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
