"use client";

import {useEffect, useRef, useState} from "react";
import {ApiClientError} from "@/lib/api/client";

type Draft = {file: File; purpose: string; uploaded?: string};
type Progress = {percent: number; finished: number; total: number; phase: "Uploading" | "Processing" | "Saving"};

function upload(entry: Draft, signal: AbortSignal, progress: (fraction: number, processing: boolean) => void) {
  return new Promise<string>((resolve, reject) => {
    if (signal.aborted) {reject(new Error("Upload cancelled.")); return;}
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    signal.addEventListener("abort", abort, {once: true});
    request.onloadend = () => signal.removeEventListener("abort", abort);
    request.open("POST", "/api/v1/uploads");
    request.setRequestHeader("Content-Type", entry.file.type);
    request.setRequestHeader("X-Upload-Purpose", entry.purpose);
    request.setRequestHeader("X-Staged-Upload", "1");
    request.responseType = "json";
    request.upload.onprogress = (event) => {if (event.lengthComputable) progress(event.loaded / event.total, false);};
    request.upload.onload = () => progress(1, true);
    request.onload = () => {
      const url = request.response?.data?.url;
      if (request.status === 201 && typeof url === "string") resolve(url);
      else reject(new Error(request.response?.error?.message || "The file could not be uploaded."));
    };
    request.onerror = () => reject(new Error("The upload was interrupted. Try again."));
    request.onabort = () => reject(new Error("Upload cancelled."));
    request.send(entry.file);
  });
}

export function useMediaDrafts() {
  const drafts = useRef(new Map<string, Draft>());
  const saveRequest = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    const entries = drafts.current;
    return () => {
      saveRequest.current?.abort();
      for (const url of entries.keys()) URL.revokeObjectURL(url);
      entries.clear();
    };
  }, []);

  function stage(file: File, purpose: string) {
    const url = URL.createObjectURL(file);
    drafts.current.set(url, {file, purpose});
    return url;
  }

  function discard(url: string) {
    if (drafts.current.delete(url)) URL.revokeObjectURL(url);
  }

  function reset() {
    for (const url of drafts.current.keys()) discard(url);
  }

  async function save<T, R>(body: T, persist: (resolved: T) => Promise<R>): Promise<R> {
    const pending = new Map<string, Draft>();
    function visit(value: unknown, replace: boolean): unknown {
      if (typeof value === "string") {
        const entry = drafts.current.get(value);
        if (entry) {
          if (!replace) pending.set(value, entry);
          return replace ? entry.uploaded : value;
        }
        return value;
      }
      if (Array.isArray(value)) return value.map((entry) => visit(entry, replace));
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, visit(entry, replace)]));
      return value;
    }
    visit(body, false);
    if (!pending.size) return persist(body);

    const controller = new AbortController();
    saveRequest.current = controller;
    const total = pending.size;
    const bytes = [...pending.values()].reduce((sum, entry) => sum + entry.file.size, 0);
    let finished = 0;
    let completedBytes = 0;
    setProgress({percent: 0, finished, total, phase: "Uploading"});
    try {
      for (const entry of pending.values()) {
        try {
          entry.uploaded ??= await upload(entry, controller.signal, (fraction, processing) => {
            const percent = Math.min(99, Math.round(100 * (completedBytes + entry.file.size * fraction) / Math.max(1, bytes)));
            setProgress({percent, finished, total, phase: processing ? "Processing" : "Uploading"});
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "The file could not be uploaded.";
          const field = entry.purpose.split(":")[1];
          throw new ApiClientError(message, 422, {[field]: message});
        }
        completedBytes += entry.file.size;
        finished += 1;
      }
      setProgress({percent: 100, finished, total, phase: "Saving"});
      return await persist(visit(body, true) as T);
    } finally {
      saveRequest.current = null;
      if (!controller.signal.aborted) setProgress(null);
    }
  }

  return {stage, discard, reset, save, progress, file: (url: string) => drafts.current.get(url)?.file};
}

export type MediaDrafts = ReturnType<typeof useMediaDrafts>;
