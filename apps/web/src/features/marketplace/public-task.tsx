"use client";

import {useTranslations} from "next-intl";

import Link from "next/link";
import {useCallback, useEffect, useRef, useState} from "react";
import toast from "react-hot-toast";
import {leadCreatorRoles, leadVisitorLabels, leadVisitorTypes, type LeadVisitorType, workspaceSubmissionStatuses} from "@the-property-pillar/contracts";
import {publicTaskHref, publicTasks, type PublicTaskPath} from "@/config/public-tasks";
import {useMarketplaceAuth} from "@/features/auth/marketplace-session";
import {useMobilePrompt} from "@/features/auth/mobile-auth";
import {loginHref, loginRequestEvent} from "@/features/auth/login-return";
import {getCollectionDescriptor} from "@/features/dashboard/collection-config";
import {FeaturePlacement} from "@/features/dashboard/feature-placement";
import {roleConfigs} from "@/features/dashboard/role-config";
import type {WorkspaceItem} from "@/features/dashboard/types";
import {ProjectWorkbench} from "@/features/projects/workbench";
import {WorkspaceForm, type WorkspaceMutation} from "@/features/dashboard/workspace-form";
import {ApiClientError, apiRequest} from "@/lib/api/client";
import {LoanEnquiryForm} from "./loan-enquiry-form";
import {usePropertyContactProfile} from "./property-contact-profile";
import styles from "./public-task.module.css";

const taskInstructions: Record<PublicTaskPath, string> = {
  "post-property": "Enter the asking price, area, location and property type. Add a clear photo before submitting for review.",
  "properties/enquire": "Choose the property or project and how you would like the listing owner to follow up.",
  "properties/save-search": "Specify your location and price range. Your saved criteria will be available in your dashboard.",
  "materials/request-quote": "Choose a delivery city and add a category, unit and quantity for each item you need.",
  "materials/add-product": "Choose the material category and selling unit. Add delivery cities, availability and a product photo.",
  "professionals/request": "Choose a published professional and describe what you need and where the work is located.",
  "professionals/register": "Describe your service and the areas you cover. Add your qualifications or experience and choose which contact details can appear publicly.",
  "jobs/apply": "Choose an open job and attach your résumé. Include a short note if you want to explain your experience.",
  "workers/register": "Add your trade, working city, daily rate and contact number. You can manage availability from your dashboard after review.",
  "dealers/register": "Enter your agency details, service cities and contact preferences. Complete the registration fields before submitting for review.",
  "projects/new": "Enter the project location, registration details and starting price. Add a project photo for review.",
  "finance-services/apply": "Provide your contact details and requested amount. Confirm that the team can contact you about this enquiry.",
  "support/report": "Choose the closest issue category and describe what happened. Include a listing reference if you have one.",
};

const draftLifetime = 25 * 60_000;
const draftKey = () => "tpp-login-draft:" + window.location.pathname + window.location.search;

export function PublicTask({locale, path, initial, project}: {
  locale: string; path: PublicTaskPath; initial: WorkspaceMutation; project: boolean;
}) {
  const task = publicTasks[path];
  const t = useTranslations("Site");
  const isLoan = task.collection === "loanInquiries";
  const lead = ["propertyInquiries", "loanInquiries", "materialRfqs", "serviceInquiries"].includes(task.collection);
  const auth = useMarketplaceAuth();
  const mobile = useMobilePrompt();
  const contact = usePropertyContactProfile(lead);
  const submissionId = useRef("");
  const [saved, setSaved] = useState<WorkspaceItem | null>(null);
  const [restored, setRestored] = useState<WorkspaceMutation | null>(null);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const draft = useRef<WorkspaceMutation>(null);
  const resultPanel = useRef<HTMLDivElement>(null);
  const session = auth?.session;
  const [resumedProperty,setResumedProperty]=useState<WorkspaceItem>();
  useEffect(()=>{const id=new URL(window.location.href).searchParams.get("draft");if(path!=="post-property"||!session||!id)return;const c=new AbortController();apiRequest<WorkspaceItem>("/workspace/properties/"+encodeURIComponent(id),{signal:c.signal}).then(item=>{if(item.status==="DRAFT")setResumedProperty(item);else setSaved(item)}).catch(e=>{if(!c.signal.aborted)setSwitchError(e.message)});return()=>c.abort()},[path,session]);
  const guestLead = lead && !session && auth?.state !== "loading";
  const base = getCollectionDescriptor(task.collection);
  const descriptor = lead ? {...base, createRoles: leadCreatorRoles, fields: [
    ...(!base.fields.some(({key}) => key === "fullName") ? [{key: "fullName", label: "Full name", type: "text" as const, required: true}] : []),
    ...base.fields.map((field) => ["fullName", "phone"].includes(field.key) ? {...field, required: true} : field),
    ...(guestLead ? [{key: "visitorType", label: "Which best describes you?", type: "select" as const, required: true,
      options: leadVisitorTypes.map((value) => ({value, label: leadVisitorLabels[value]}))}] : []),
  ]} : task.collection === "grievances"
    ? {...base, fields: base.fields.filter(({key}) => key !== "resolutionNote")}
    : base;
  const roles = [...new Set(descriptor.createRoles.filter(role => role !== "ADMIN"))].map((role) => ({
    role, label: roleConfigs[role].label, description: roleConfigs[role].description, icon: roleConfigs[role].icon,
  }));
  const allowed = Boolean(session && descriptor.createRoles.includes(session.role));
  const canSubmit = allowed || (lead && !session && auth?.state === "guest");
  const workspace = `/${locale}/dashboard?view=${task.collection}`;

  useEffect(() => {
    try {
      const key = draftKey();
      const entry = sessionStorage.getItem(key);
      sessionStorage.removeItem(key);
      if (entry) {
        const {value, expires} = JSON.parse(entry);
        if (expires > Date.now() && value && typeof value.title === "string" && value.data && typeof value.data === "object") setRestored(value);
      }
    } catch {}
  }, [path, project]);
  useEffect(() => {
    if (saved) resultPanel.current?.focus();
  }, [saved]);

  const requestAccess = useCallback(() => {
    try {
      if (draft.current) sessionStorage.setItem(draftKey(), JSON.stringify({value: draft.current, expires: Date.now() + draftLifetime}));
    } catch {}
    const next = window.location.pathname + window.location.search + window.location.hash;
    window.location.assign(loginHref(locale, next));
  }, [locale]);

  useEffect(() => {
    if (saved || session) return;
    function handle(event: Event) { event.preventDefault(); requestAccess(); }
    window.addEventListener(loginRequestEvent, handle);
    return () => window.removeEventListener(loginRequestEvent, handle);
  }, [requestAccess, saved, session]);

  async function switchAccount() {
    if (switching) return;
    setSwitchError("");
    setSwitching(true);
    try {
      await apiRequest("/auth/logout", {method: "POST"});
      requestAccess();
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : "Could not switch accounts. Try again.");
      setSwitching(false);
    }
  }

  async function save(payload: WorkspaceMutation) {
    let verified = false;
    try {
      if (lead && !session) {
        const identity = await mobile.verify({scope: "workspace:" + task.collection,
          identity: {fullName: String(payload.data?.fullName ?? ""), phone: String(payload.data?.phone ?? ""), visitorType: payload.data?.visitorType as LeadVisitorType}});
        if (!identity || identity === true) return false as const;
        verified = true;
        payload = {...payload, data: {...payload.data, fullName: identity.fullName, phone: identity.phone}};
      }
      if (lead && !submissionId.current) submissionId.current = window.crypto.randomUUID();
      const {savedPropertyId,...mutation}=payload;
      const record = await apiRequest<WorkspaceItem>(`/workspace/${task.collection}`+(savedPropertyId?"/"+savedPropertyId:""), {method: savedPropertyId?"PATCH":"POST", body: {
        ...mutation, ...(lead ? {requestId: submissionId.current, locale} : {}),
      }});
      setSaved(record);
      toast.success(isLoan ? "Loan enquiry received" : record.status === "DRAFT" ? "Draft saved" : "Submission saved");
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        requestAccess();
        return false as const;
      }
      throw error;
    } finally {if (verified) void auth?.refresh();}
  }

  if(path==="projects/new")return <div className={styles.task}><h1>List a Builder project</h1>{session?.role==="BUILDER"||session?.role==="ADMIN"?<ProjectWorkbench locale={locale} admin={session.role==="ADMIN"}/>:auth?.state==="loading"?<p aria-busy="true">Loading account…</p>:session?<p>Use a Builder account to create a project.</p>:<button className="market-button" onClick={requestAccess}>Sign in to list a project</button>}</div>;
  const otherEnquiry = project ? undefined : new URLSearchParams({kind: "project"});
  return <div className={styles.task}>
    <header>
      <h1 id="public-task-title">{t(task.title)}</h1>
      <p>{locale !== "en" ? t("formIntro") : isLoan ? "Share your contact and loan details so our team can review your request and follow up." : descriptor.description}</p>
      {path === "properties/enquire" && <Link className="market-text-link" href={publicTaskHref(locale, path, otherEnquiry)}>
        {project ? "Enquire about a property" : "Enquire about a builder project"}
      </Link>}
    </header>
    {!saved && <details className={styles.taskGuide}>
      <summary>{t("formHelp")}</summary>
      <ol>
        {locale === "en" && <li>{taskInstructions[path]}</li>}
        <li>{lead ? "Verify your mobile number when submitting as a guest." : t("formHelpSignIn")}</li>
        <li>{t("formHelpTrack")}</li>
      </ol>
    </details>}
    {saved ? <div className={styles.notice} role="status" ref={resultPanel} tabIndex={-1}>
      <h2>{isLoan ? "Loan enquiry received" : saved.status === "DRAFT" ? "Draft saved" : "Submission saved"}</h2>
      <p>Reference <strong>{saved.id}</strong></p>
      <p>Status <strong>{isLoan && saved.status === "NEW" ? "New" : saved.status.replaceAll("_", " ")}</strong></p>
      {isLoan && <p>Our team will review the details and follow up using the contact information you provided.</p>}
      {task.collection === "properties" && saved.status === "PENDING_REVIEW" && <p>Your property will appear in marketplace search after an admin publishes it.</p>}
      <FeaturePlacement collection={task.collection} item={saved} />
      <Link className="market-button" href={workspace}>{isLoan ? "Track loan enquiry" : "Manage in dashboard"}</Link>
    </div> : <>
      {!session && auth?.state !== "loading" && (!lead || auth?.state === "error") && <div className={styles.notice}>
        {auth?.state === "error" ? <p>Account service is unavailable. Your form is still here. <button type="button" className="market-text-link" onClick={() => void auth.refresh()}>Retry account connection</button></p>
          : locale === "en" ? <p>Start filling the form below. <button type="button" className="market-text-link" onClick={requestAccess}>Sign in or register</button> when you are ready to submit.</p>
            : <p>{t("formHelpSignIn")} <button type="button" className="market-text-link" onClick={requestAccess}>{t("signIn")}</button></p>}
      </div>}
      {session && !allowed && <div className={styles.notice} role="status">
        <p>This task requires one of these accounts: {roles.map(({label}) => label).join(", ")}. You are signed in as {roleConfigs[session.role].label}.</p>
        <button className="market-text-link" type="button" disabled={switching} onClick={() => void switchAccount()}>Switch account</button>
        {switchError && <p role="alert">{switchError}</p>}
      </div>}
      {session && allowed && restored && <p className={styles.notice} role="status">Your form has been restored. Review your information and submit when ready.</p>}
      {isLoan ? <LoanEnquiryForm key={String(Boolean(restored))} initial={restored ?? initial}
        canSubmit={canSubmit} guestLead={guestLead} contactDefaults={contact} requestAccess={session ? () => void switchAccount() : requestAccess} draftRef={draft} onSave={save} />
      : <WorkspaceForm key={`${path}:${project}:${resumedProperty?.id??Boolean(restored)}`} descriptor={descriptor} posterRole={session?.role} onClose={() => undefined} onSave={save} publicTask={{resumedProperty,
        action: task.action, initial: restored ?? initial, canSubmit, contactDefaults: lead ? contact : undefined,
        requestAccess: session ? () => void switchAccount() : requestAccess, draftRef: draft,
        allowDraft: task.collection === "materialRfqs",
        submitStatus: workspaceSubmissionStatuses[task.collection as keyof typeof workspaceSubmissionStatuses],
      }} />}
      {session && !allowed && <Link className="market-text-link" href={workspace}>Open dashboard</Link>}
    </>}
    {mobile.dialog}
  </div>;
}

