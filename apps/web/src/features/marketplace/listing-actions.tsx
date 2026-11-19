"use client";

import Link from "next/link";
import {Bookmark, Copy, Phone, Send} from "lucide-react";
import {useState} from "react";
import {ApiClientError, apiRequest} from "@/lib/api/client";
import type {DirectoryKey} from "@/config/marketplace";
import {publicTaskHref, type PublicTaskPath} from "@/config/public-tasks";
import {useMarketplaceSession} from "@/features/auth/marketplace-session";
import styles from "./directory.module.css";

const actions: Partial<Record<DirectoryKey, {path: PublicTaskPath; label: string}>> = {
  properties: {path: "properties/enquire", label: "Enquire about this property"},
  projects: {path: "properties/enquire", label: "Enquire about this project"},
  professionals: {path: "professionals/request", label: "Request a service"},
  jobs: {path: "jobs/apply", label: "Apply for this job"},
  materials: {path: "materials/request-quote", label: "Request material quotes"},
};

export function ListingActions({kind, id, title, locale, phone, whatsapp}: {
  kind: DirectoryKey; id: string; title: string; locale: string; phone?: string; whatsapp?: string;
}) {
  const [feedback, setFeedback] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [pending, setPending] = useState(false);
  const session = useMarketplaceSession();
  const action = actions[kind];
  const params = new URLSearchParams({title});
  if (kind !== "materials") params.set("record", id);
  if (kind === "projects") params.set("kind", "project");
  const directPhone = phone && /^\+?[0-9]{8,15}$/.test(phone) ? phone : "";
  const whatsAppNumber = whatsapp && /^\+[0-9]{8,15}$/.test(whatsapp) ? whatsapp.slice(1) : "";

  async function saveProperty() {
    setPending(true);
    setNeedsLogin(false);
    setFeedback("");
    try {
      await apiRequest("/workspace/savedProperties", {method: "POST", body: {title, data: {propertyId: id}}});
      setFeedback("Saved to your dashboard.");
    } catch (error) {
      setNeedsLogin(error instanceof ApiClientError && error.status === 401);
      setFeedback(error instanceof Error ? error.message : "Could not save this property.");
    } finally {
      setPending(false);
    }
  }

  async function copyLink() {
    setNeedsLogin(false);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setFeedback("Link copied.");
    } catch {
      setFeedback("Copy the page address from your browser to share it.");
    }
  }

  return (
    <div className={styles.actions}>
      {action && <Link className={styles.primaryButton} href={publicTaskHref(locale, action.path, params)}>
        <Send size={16} aria-hidden="true" />{action.label}
      </Link>}
      {kind === "properties" && <button className={styles.secondaryButton} type="button" disabled={pending} onClick={() => void saveProperty()}>
        <Bookmark size={16} aria-hidden="true" />Save property
      </button>}
      {directPhone && <a href={"tel:" + directPhone} className={styles.secondaryButton}><Phone size={16} aria-hidden="true" />Call</a>}
      {whatsAppNumber && <a href={"https://wa.me/" + whatsAppNumber} target="_blank" rel="noopener noreferrer" className={styles.secondaryButton}>WhatsApp</a>}
      <button onClick={() => void copyLink()} type="button" className={styles.clearButton}><Copy size={16} aria-hidden="true" />Copy page link</button>
      {feedback && <div className={styles.feedback} role="status">{feedback} {needsLogin && <Link className={styles.detailLink} href={`/${locale}/dashboard`}>{session ? "Open workspace" : "Sign in"}</Link>}</div>}
    </div>
  );
}
