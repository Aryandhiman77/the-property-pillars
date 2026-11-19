import {useEffect, useState, type ComponentProps} from "react";
import {apiRequest} from "@/lib/api/client";
import type {Workspace, WorkspaceItem} from "./types";

type Reference = {
  path: string;
  collection?: string;
  statuses?: string[];
};

const references: Record<string, Reference> = {
  propertyId: {path: "/public/properties?limit=100"},
  serviceProfileId: {path: "/public/professionals?limit=100"},
  jobId: {path: "/public/jobs?limit=100"},
  rfqId: {path: "/workspace", collection: "materialRfqs", statuses: ["OPEN", "QUOTING", "QUOTES_RECEIVED"]},
  projectId: {path: "/workspace", collection: "builderProjects", statuses: ["APPROVED", "PUBLISHED"]},
};

const immutableReferences = new Set(["propertyId", "serviceProfileId", "jobId", "rfqId"]);

export function isRecordReference(field: string) {
  return Object.hasOwn(references, field);
}

export function isImmutableRecordReference(field: string) {
  return immutableReferences.has(field);
}

export function RecordReference({field, value, required, locked = false, publicProject = false, onChange, ...fieldAttributes}: {
  field: string; value: string; required?: boolean; locked?: boolean; publicProject?: boolean; onChange: (value: string) => void;
} & Pick<ComponentProps<"select">, "name" | "aria-invalid" | "aria-describedby">) {
  const [items, setItems] = useState<WorkspaceItem[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const reference = publicProject ? {path: "/public/projects?limit=100"} : references[field];
    const controller = new AbortController();
    async function load() {
      try {
        const result = await apiRequest<Workspace | WorkspaceItem[]>(reference.path, {signal: controller.signal});
        const records = Array.isArray(result)
          ? result
          : result.collections.find(({key}) => key === reference.collection)?.items ?? [];
        setItems(records.filter(({status}) => !reference.statuses || reference.statuses.includes(status)));
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt, field, publicProject]);

  return (
    <>
      <select {...fieldAttributes} disabled={locked} value={value} required={required} onChange={(event) => onChange(event.target.value)}>
        <option value="">{!items && !error ? "Loading eligible records…" : "Select a record"}</option>
        {value && !items?.some(({id}) => id === value) && <option value={value}>{locked ? "Current record (fixed)" : "Current record"}</option>}
        {items?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
      {locked ? <small>This linked record cannot be changed after creation.</small> : null}
      {error && <small>Could not load eligible records. <button className="underline" type="button" onClick={() => {setError(false); setAttempt((value) => value + 1);}}>Retry</button></small>}
      {!error && items?.length === 0 && !value && <small>{field === "rfqId" ? "No open RFQs match your published products and delivery cities yet." : "No eligible records are available yet."}</small>}
    </>
  );
}
