"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { ApiClientError, apiRequest } from "@/lib/api/client";
import type { BillingPlan } from "./types";
import s from "./plan-admin.module.css";

export function ListingPlanDetails({
  id,
  locale,
}: {
  id: string;
  locale: string;
}) {
  const [plan, setPlan] = useState<
    (BillingPlan & { preview: boolean; active: boolean }) | null
  >(null);
  const [error, setError] = useState("");
  const dashboard = "/" + locale + "/dashboard?view=billing";
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<BillingPlan & { preview: boolean; active: boolean }>(
      "/catalog/plans/" + encodeURIComponent(id),
      { signal: controller.signal },
    )
      .then(setPlan)
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ApiClientError && cause.status === 401) {
          window.location.replace(
            "/" +
              locale +
              "/login?next=" +
              encodeURIComponent(window.location.pathname),
          );
          return;
        }
        setError(
          cause instanceof Error ? cause.message : "Unable to load this plan.",
        );
      });
    return () => controller.abort();
  }, [id, locale]);
  return (
    <main className={s.details}>
      <Link href={dashboard}>
        <ArrowLeft size={16} /> Plans and billing
      </Link>
      {error ? (
        <p role="alert">{error}</p>
      ) : !plan ? (
        <div role="status">Loading plan…</div>
      ) : (
        <article>
          <h1>{plan.name}</h1>
          <p>{plan.description}</p>
          <dl>
            <div>
              <dt>Price including tax</dt>
              <dd>
                {new Intl.NumberFormat(locale, {
                  style: "currency",
                  currency: plan.currency,
                }).format(plan.totalPaise / 100)}
              </dd>
            </div>
            <div>
              <dt>Validity</dt>
              <dd>{plan.entitlementDays} days</dd>
            </div>
            {!!plan.postingCredits && (
              <div>
                <dt>Property credits</dt>
                <dd>{plan.postingCredits}</dd>
              </div>
            )}
          </dl>
          {!!plan.highlights?.length && (
            <ul>
              {plan.highlights.map((h, index) => (
                <li key={index}>
                  <Check size={16} />
                  {h}
                </li>
              ))}
            </ul>
          )}
          {plan.aboutHtml && (
            <section>
              <h2>About this plan</h2>
              <div dangerouslySetInnerHTML={{ __html: plan.aboutHtml }} />
            </section>
          )}
          {plan.preview ? (
            <p>Admin preview · {plan.active ? "Published" : "Draft"}</p>
          ) : (
            <Link
              className={s.choose}
              href={dashboard + "&plan=" + encodeURIComponent(id)}
            >
              Choose plan
            </Link>
          )}
        </article>
      )}
    </main>
  );
}
