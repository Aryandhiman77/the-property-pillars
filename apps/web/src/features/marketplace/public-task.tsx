"use client";

import Link from "next/link";
import {useCallback, useEffect, useRef, useState} from "react";
import toast, {Toaster} from "react-hot-toast";
import {workspaceSubmissionStatuses} from "@the-property-pillar/contracts";
import {publicTaskHref, publicTasks, type PublicTaskPath} from "@/config/public-tasks";
import {useMarketplaceAuth} from "@/features/auth/marketplace-session";
import {loginHref, loginRequestEvent} from "@/features/auth/login-return";
import {getCollectionDescriptor} from "@/features/dashboard/collection-config";
import {roleConfigs} from "@/features/dashboard/role-config";
import type {WorkspaceItem} from "@/features/dashboard/types";
import {WorkspaceForm, type WorkspaceMutation} from "@/features/dashboard/workspace-form";
import {ApiClientError, apiRequest} from "@/lib/api/client";
import styles from "./public-task.module.css";

const draftLifetime = 25 * 60_000;
const draftKey = () => "tpp-login-draft:" + window.location.pathname + window.location.search;

export function PublicTask({locale, path, initial, project}: {
  locale: string; path: PublicTaskPath; initial: WorkspaceMutation; project: boolean;
}) {
  const task = publicTasks[path];
  const auth = useMarketplaceAuth();
  const [saved, setSaved] = useState<WorkspaceItem | null>(null);
  const [restored, setRestored] = useState<WorkspaceMutation | null>(null);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const draft = useRef<WorkspaceMutation>(null);
  const resultPanel = useRef<HTMLDivElement>(null);
  const base = getCollectionDescriptor(task.collection);
  const descriptor = task.collection === "grievances"
    ? {...base, fields: base.fields.filter(({key}) => key !== "resolutionNote")}
    : base;
  const roles = descriptor.createRoles.filter((role) => role !== "ADMIN").map((role) => ({
    role, label: roleConfigs[role].label, description: roleConfigs[role].description, icon: roleConfigs[role].icon,
  }));
  const session = auth?.session;
  const allowed = Boolean(session && descriptor.createRoles.includes(session.role));
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
    try {
      const record = await apiRequest<WorkspaceItem>(`/workspace/${task.collection}`, {method: "POST", body: payload});
      setSaved(record);
      toast.success(record.status === "DRAFT" ? "Draft saved" : "Submission saved");
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        requestAccess();
        return false as const;
      }
      throw error;
    }
  }

  const otherEnquiry = project ? undefined : new URLSearchParams({kind: "project"});
  return <div className={styles.task}>
    <header>
      <h1 id="public-task-title">{task.title}</h1>
      <p>{descriptor.description}</p>
      {path === "properties/enquire" && <Link className="market-text-link" href={publicTaskHref(locale, path, otherEnquiry)}>
        {project ? "Enquire about a property" : "Enquire about a builder project"}
      </Link>}
    </header>
    {saved ? <div className={styles.notice} role="status" ref={resultPanel} tabIndex={-1}>
      <h2>{saved.status === "DRAFT" ? "Draft saved" : "Submission saved"}</h2>
      <p>Reference <strong>{saved.id}</strong></p>
      <p>Status <strong>{saved.status.replaceAll("_", " ")}</strong></p>
      <Link className="market-button" href={workspace}>Manage in dashboard</Link>
    </div> : <>
      {!session && auth?.state !== "loading" && <div className={styles.notice}>
        {auth?.state === "error" ? <p>Account service is unavailable. Your form is still here. <button type="button" className="market-text-link" onClick={() => void auth.refresh()}>Retry account connection</button></p>
          : <p>Start filling the form below. <button type="button" className="market-text-link" onClick={requestAccess}>Sign in or register</button> when you are ready to submit.</p>}
      </div>}
      {session && !allowed && <div className={styles.notice} role="status">
        <p>This task requires one of these accounts: {roles.map(({label}) => label).join(", ")}. You are signed in as {roleConfigs[session.role].label}.</p>
        <button className="market-text-link" type="button" disabled={switching} onClick={() => void switchAccount()}>Switch account</button>
        {switchError && <p role="alert">{switchError}</p>}
      </div>}
      {session && allowed && restored && <p className={styles.notice} role="status">Your form has been restored. Review your information and submit when ready.</p>}
      <WorkspaceForm key={`${path}:${project}:${Boolean(restored)}`} descriptor={descriptor} onClose={() => undefined} onSave={save} publicTask={{
        action: task.action, initial: restored ?? initial, canSubmit: allowed,
        requestAccess: session ? () => void switchAccount() : requestAccess, draftRef: draft,
        allowDraft: task.collection === "materialRfqs",
        submitStatus: workspaceSubmissionStatuses[task.collection as keyof typeof workspaceSubmissionStatuses],
      }} />
      {session && !allowed && <Link className="market-text-link" href={workspace}>Open dashboard</Link>}
    </>}
    <Toaster position="top-right" />
  </div>;
}

