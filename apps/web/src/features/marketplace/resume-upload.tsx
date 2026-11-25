"use client";

import {MaterialInput} from "@/components/ui/material-fields";

import {useId, useState, type ComponentProps} from "react";
import {MAX_RESUME_BYTES} from "@the-property-pillar/contracts";
import {ApiClientError, apiRequest} from "@/lib/api/client";

export function isResumePath(value: unknown): value is string {
  return typeof value === "string" && /^\/api\/v1\/uploads\/resumes\/[a-f0-9]{64}-[a-f0-9-]{36}\.(pdf|doc|docx)$/.test(value);
}

export function ResumeUpload({value, onChange, onBusy, onFailure, ...attributes}: {
  value: string;
  onChange: (url: string) => void;
  onBusy: (busy: boolean) => void;
  onFailure?: (error: unknown) => void;
} & Pick<ComponentProps<"input">, "name" | "aria-invalid" | "aria-describedby">) {
  const id = useId();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (file.size > MAX_RESUME_BYTES || !/\.(pdf|docx?)$/i.test(file.name)) {
      setError("Choose a PDF, DOC, or DOCX file up to 10 MB.");
      return;
    }
    setBusy(true);
    onBusy(true);
    try {
      const {url} = await apiRequest<{url: string}>("/uploads/resumes", {
        method: "POST", body: file, headers: {"Content-Type": "application/octet-stream"},
      });
      onChange(url);
    } catch (failure) {
      setError(failure instanceof ApiClientError && failure.status === 413
        ? "The résumé must be 10 MB or smaller."
        : failure instanceof Error ? failure.message : "The résumé could not be uploaded.");
      onFailure?.(failure);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  return <>
    <MaterialInput {...attributes} aria-invalid={Boolean(error) || attributes["aria-invalid"] || undefined}
      aria-describedby={[id, attributes["aria-describedby"]].filter(Boolean).join(" ")}
      accept=".pdf,.doc,.docx" disabled={busy} type="file" onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        void upload(file);
      }} />
    <small id={id} role={error ? "alert" : "status"}>{error || (busy ? "Uploading résumé…" : value ? "Résumé attached." : "PDF, DOC or DOCX. Maximum 10 MB.")}</small>
    {isResumePath(value) && <a href={value} download>Download attached résumé</a>}
  </>;
}
