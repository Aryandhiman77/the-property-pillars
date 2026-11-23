"use client";

import Link from "next/link";
import {Copy, Phone, Send} from "lucide-react";
import {useState} from "react";
import type {DirectoryKey} from "@/config/marketplace";
import {publicTaskHref, type PublicTaskPath} from "@/config/public-tasks";
import styles from "./directory.module.css";

const actions: Partial<Record<DirectoryKey, {path: PublicTaskPath; label: string}>> = {
  projects: {path: "properties/enquire", label: "Enquire about this project"},
  professionals: {path: "professionals/request", label: "Request a service"},
  jobs: {path: "jobs/apply", label: "Apply for this job"},
  materials: {path: "materials/request-quote", label: "Request material quotes"},
};

export function ListingActions({kind, id, title, locale, phone, whatsapp, acceptingApplications}: {
  kind: DirectoryKey; id: string; title: string; locale: string; phone?: string; whatsapp?: string; acceptingApplications?: boolean;
}) {
  const [feedback, setFeedback] = useState("");
  const applicationsClosed = kind === "jobs" && acceptingApplications === false;
  const action = applicationsClosed ? undefined : actions[kind];
  const params = new URLSearchParams({title});
  if (kind !== "materials") params.set("record", id);
  if (kind === "projects") params.set("kind", "project");
  const directPhone = kind !== "properties" && phone && /^\+?[0-9]{8,15}$/.test(phone) ? phone : "";
  const whatsAppNumber = kind !== "properties" && whatsapp && /^\+[0-9]{8,15}$/.test(whatsapp) ? whatsapp.slice(1) : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setFeedback("Link copied.");
    } catch {
      setFeedback("Copy the page address from your browser to share it.");
    }
  }

  return (
    <div className={styles.actions}>
      {applicationsClosed && <p>Applications have closed.</p>}
      {action && <Link className={styles.primaryButton} href={publicTaskHref(locale, action.path, params)}>
        <Send size={16} aria-hidden="true" />{action.label}
      </Link>}
      {directPhone && <a href={"tel:" + directPhone} className={styles.secondaryButton}><Phone size={16} aria-hidden="true" />Call</a>}
      {whatsAppNumber && <a href={"https://wa.me/" + whatsAppNumber} target="_blank" rel="noopener noreferrer" className={styles.secondaryButton}>WhatsApp</a>}
      {kind === "dealers" && !directPhone && !whatsAppNumber && <a href="#dealer-properties" className={styles.secondaryButton}><Send size={16} aria-hidden="true" /> Enquire about a listing</a>}
      <button onClick={() => void copyLink()} type="button" className={styles.clearButton}><Copy size={16} aria-hidden="true" />Copy page link</button>
      {feedback && <div className={styles.feedback} role="status">{feedback}</div>}
    </div>
  );
}
