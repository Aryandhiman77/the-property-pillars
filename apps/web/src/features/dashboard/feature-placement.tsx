"use client";

import {useEffect, useState, type ReactNode} from "react";
import Link from "next/link";
import {useLocale} from "next-intl";
import {Download, Sparkles} from "lucide-react";
import {paidFeatureCollections} from "@the-property-pillar/contracts";
import type {FeaturePayment} from "@/features/billing/types";
import {apiRequest} from "@/lib/api/client";
import type {WorkspaceItem} from "./types";
import styles from "./dashboard.module.css";

const supported = new Set<string>(paidFeatureCollections);
const statusLabels: Record<FeaturePayment["status"], string> = {
  UNPAID: "Unpaid", CREATING: "Creating payment", PAYMENT_PENDING: "Payment pending",
  FAILED: "Payment failed", CAPTURED: "Paid", REFUNDED: "Refunded",
};

export function FeaturePlacement({collection, item, admin = false, children, onNavigate}: {
  collection: string; item: WorkspaceItem; admin?: boolean; children?: ReactNode; onNavigate?: () => void;
}) {
  const locale = useLocale();
  const [payment, setPayment] = useState<FeaturePayment | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!supported.has(collection)) return;
    const controller = new AbortController();
    setPayment(null);
    setError(false);
    void apiRequest<FeaturePayment>(`/feature-payments/${encodeURIComponent(item.id)}`, {signal: controller.signal})
      .then((result) => {if (!controller.signal.aborted) setPayment(result);}, () => {if (!controller.signal.aborted) setError(true);});
    return () => controller.abort();
  }, [collection, item.id, item.status, attempt]);

  if (!supported.has(collection)) return null;
  if (!admin && payment?.status === "UNPAID" && !payment.canPay) return null;
  const invoice = payment?.invoice;
  const amount = payment?.totalPaise !== undefined && payment.currency
    ? new Intl.NumberFormat(locale, {style: "currency", currency: payment.currency}).format(payment.totalPaise / 100) : "";
  return <>
    <section className={`${styles.wideField} ${styles.featurePlacement}`} aria-label="Featuring payment">
      <div>
        <strong><Sparkles size={16} aria-hidden="true" /> Featuring payment</strong>
        {error ? <small role="alert">Payment status unavailable. <button type="button" onClick={() => setAttempt(attempt + 1)}>Retry</button></small>
          : !payment ? <small role="status">Checking payment status…</small>
            : <small>{statusLabels[payment.status]}{invoice ? ` · ${invoice.invoiceNumber}` : ""}</small>}
      </div>
      {payment?.endsAt && <small>{payment.active ? "Featured until" : "Featuring ended"} {new Date(payment.endsAt).toLocaleDateString(locale)}</small>}
      {invoice && payment?.status === "CAPTURED" && <a className={styles.secondaryButton} href={invoice.downloadUrl} download><Download size={16} /> Download invoice</a>}
      {!admin && payment?.canPay && (payment.checkoutAvailable
          ? <Link className={styles.primaryButton} href={`/${locale}/dashboard?view=billing&feature=${encodeURIComponent(item.id)}${payment.priceId ? "&plan="+encodeURIComponent(payment.priceId) : ""}`} onNavigate={onNavigate}>
            {payment.status === "PAYMENT_PENDING" || payment.status === "FAILED" || payment.status === "CREATING" ? "Continue payment" : "Pay for featuring"}{amount ? ` · ${amount}` : ""}
          </Link> : <>
            <small>Paid featuring will be available once billing setup is complete.</small>
            <button type="button" className={styles.secondaryButton} onClick={() => setAttempt(value => value + 1)}>Check again</button>
          </>)}
      {payment?.status === "REFUNDED" && invoice && <a className={styles.secondaryButton} href={invoice.downloadUrl} download>Download refunded invoice</a>}
      {admin && !invoice && payment?.orderId && <Link className={styles.secondaryButton} href={`/${locale}/dashboard?view=billing&order=${encodeURIComponent(payment.orderId)}`} onNavigate={onNavigate}>Check payment</Link>}
    </section>
    {admin && payment?.active && children}
  </>;
}
