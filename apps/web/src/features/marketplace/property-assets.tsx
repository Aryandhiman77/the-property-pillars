"use client";

import {MaterialInput, MaterialSelect} from "@/components/ui/material-fields";
import MuiButton from "@mui/material/Button";
import {useLocale} from "next-intl";
import Link from "next/link";
import {Download, Expand, FileText} from "lucide-react";
import {FloorPlanViewer,type Drawing} from "./floor-plan-viewer";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  AREA_UNITS,
  floorPlanTypes,
  propertyDocumentTypes,
} from "@the-property-pillar/contracts";
import { ApiClientError, apiRequest } from "@/lib/api/client";
import styles from "./property-assets.module.css";

type Plan = {
  id: string;
  title: string;
  planType: string;
  floorLabel?: string;
  configurationLabel?: string;
  bedrooms?: number;
  bathrooms?: number;
  areaValue?: number;
  areaUnit?: string;
  description?: string;
  image?: string;
  pdf?: string;
  isPrimary: boolean;
};
type Doc = {
  id: string;
  title: string;
  visibility: string;
  category: string;
  url: string;
};
type Assets = {
  project?:{name:string;slug:string|null;plans:Drawing[]}|null;
  plans: Plan[];
  documents: Doc[];
  revision: number;
  status: string;
  updatedAt: string;
  imageLimit: number;
  pdfLimit: number;
};
type Kind = "plans" | "documents";
export function PropertyAssets({
  id,
  kind,
  editable = false,
  onSaved,
}: {
  id: string;
  kind: Kind;
  editable?: boolean;
  onSaved?: (stamp: string, status: string) => void;
}) {
  const locale=useLocale();
  const base = "/properties/" + encodeURIComponent(id) + "/assets",
    plans = kind === "plans";
  const [assets, setAssets] = useState<Assets>(),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(false),
    [values, setValues] = useState<Record<string, string>>({}),
    [image, setImage] = useState<File>(),
    [pdf, setPdf] = useState<File>(),
    [doc, setDoc] = useState<File>(),
    [zoom, setZoom] = useState<{title:string;image?:string|null}>();
  const drag = useRef("");
  useEffect(() => {
    const c = new AbortController();
    apiRequest<Assets>(base, { signal: c.signal })
      .then(setAssets)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [base]);

  function open(p?: Plan) {
    setValues(
      p
        ? Object.fromEntries(
            Object.entries(p)
              .filter(([, v]) => v != null)
              .map(([k, v]) => [k, String(v)]),
          )
        : {
            planType: floorPlanTypes[0],
            category: "Brochure",
            visibility: "PRIVATE",
          },
    );
    setImage(undefined);
    setPdf(undefined);
    setDoc(undefined);
    setErrors({});
    setError("");
    setEditing(true);
  }
  async function run(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setErrors({});
    setError("");
    try {
      await fn();
      const fresh = await apiRequest<Assets>(base);
      setAssets(fresh);
      onSaved?.(fresh.updatedAt, fresh.status);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
      if (e instanceof ApiClientError) setErrors(e.fieldErrors);
    } finally {
      setBusy(false);
    }
  }
  function save() {
    if (!assets) return;
    const form = new FormData(),
      metadata: Record<string, unknown> = {
        title: (values.title ?? "").trim(),
      };
    if (!metadata.title) {
      setErrors({ title: "Enter a title." });
      return;
    }
    if (plans) {
      if (!values.id && !image && !pdf) {
        setErrors({ image: "Choose an image or PDF." });
        return;
      }
      for (const k of [
        "planType",
        "floorLabel",
        "configurationLabel",
        "areaUnit",
        "description",
      ])
        if (values[k]) metadata[k] = values[k];
      for (const k of ["areaValue", "bedrooms", "bathrooms"])
        if (values[k]) metadata[k] = Number(values[k]);
      metadata.isPrimary = values.isPrimary === "true";
      if (image) form.set("image", image);
      if (pdf) form.set("pdf", pdf);
      if (values.id) form.set("id", values.id);
    } else {
      if (!doc) {
        setErrors({ file: "Choose a document." });
        return;
      }
      metadata.category = values.category;
      metadata.visibility = values.visibility;
      form.set("file", doc);
    }
    form.set("metadata", JSON.stringify(metadata));
    form.set("revision", String(assets.revision));
    void run(() =>
      apiRequest(base + "/" + kind, { method: "POST", body: form }),
    );
  }
  function field(
    k: string,
    label: string,
    options?: readonly string[],
    type = "text",
  ) {
    const change = (v: string) =>
      setValues((s) => ({
        ...s,
        [k]: v,
        ...(k === "category" && !["Brochure", "Marketing plan"].includes(v)
          ? { visibility: "PRIVATE" }
          : {}),
      }));
    return (
      <label key={k}>
        {label}
        {options ? (
          <MaterialSelect
            aria-label={label}
            value={values[k] ?? ""}
            onChange={(e) => change(e.target.value)}
          >
            <option value="">Select</option>
            {options.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </MaterialSelect>
        ) : (
          <MaterialInput
            type={type}
            min={0}
            value={values[k] ?? ""}
            onChange={(e) => change(e.target.value)}
          />
        )}
        <small role={errors[k] ? "alert" : undefined}>{errors[k]}</small>
      </label>
    );
  }
  function reorder(from: number, to: number) {
    if (
      !assets ||
      to < 0 ||
      to >= assets.plans.length ||
      from < 0 ||
      from === to
    )
      return;
    const ids = assets.plans.map((p) => p.id);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    void run(() =>
      apiRequest(base + "/plans/order", {
        method: "PATCH",
        body: { revision: assets.revision, ids },
      }),
    );
  }
  if (!assets && !error)
    return (
      <div
        className={styles.loading}
        aria-label="Loading listing files"
        aria-busy="true"
      />
    );
  const entries = assets ? (plans ? assets.plans : assets.documents) : [];
  if (!editable && !entries.length && !(plans && assets?.project)) return null;
  return (
    <section
      className={styles.section}
      aria-label={plans ? "Floor plans" : "Property documents"}
    >
      <header>
        <h3>{plans ? "Floor plans" : "Property documents"}</h3>
        {editable && assets && !editing && (
          <MuiButton type="button" onClick={() => open()}>
            Add {plans ? "floor plan" : "document"}
          </MuiButton>
        )}
      </header>
      {plans && assets?.project && <div className={styles.projectGroup}>
        <p>Part of {assets.project.slug ? <Link href={`/${locale}/projects/${assets.project.slug}`}>{assets.project.name}</Link> : assets.project.name}</p>
        <div className={styles.drawings}>
          {assets.project.plans.map(d => <article key={d.id} className={styles.drawing}>
            {d.image ? <MuiButton className={styles.thumbnail} type="button" aria-label={"Open " + d.title} onClick={() => setZoom(d)}>
              <Image unoptimized src={d.image} alt="" width={320} height={180} loading="lazy" />
            </MuiButton> : <div className={styles.fileTile}><FileText aria-hidden="true" size={26} /></div>}
            <div className={styles.drawingInfo}>
              <small>{[d.planType, d.areaValue != null && [d.areaValue,d.areaUnit].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}</small>
              <h4>{d.title}</h4>
              <div className={styles.drawingActions}>
                {d.image && <MuiButton type="button" onClick={() => setZoom(d)}><Expand size={14} aria-hidden="true" />View drawing</MuiButton>}
                {d.pdf && <a href={d.pdf}><Download size={14} aria-hidden="true" />Download PDF</a>}
              </div>
            </div>
          </article>)}
        </div>
      </div>}
      {error && <p role="alert">{error}</p>}
      {editable && !entries.length && !editing && (
        <p>
          {plans
            ? "Attach a unit layout, site plan or master plan."
            : "Store private proofs or share a marketing brochure."}
        </p>
      )}
      <div className={styles.cards}>
        {entries.map((entry, index) => {
          const p = entry as Plan,
            d = entry as Doc;
          return (
            <article
              key={entry.id}
              draggable={editable && plans && !busy}
              onDragStart={() => {
                drag.current = p.id;
              }}
              onDragOver={(e) => {
                if (editable && plans) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (editable && plans)
                  reorder(
                    entries.findIndex((v) => v.id === drag.current),
                    index,
                  );
              }}
            >
              {p.image && (
                <MuiButton type="button" onClick={() => setZoom(p)}>
                  <Image
                    unoptimized
                    width={320}
                    height={208}
                    loading="lazy"
                    src={p.image}
                    alt={p.title}
                  />
                </MuiButton>
              )}
              <strong>{entry.title}</strong>
              <small>
                {plans
                  ? [
                      p.planType,
                      p.configurationLabel,
                      p.floorLabel,
                      p.areaValue && [p.areaValue, p.areaUnit].join(" "),
                      p.isPrimary && "Primary",
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : [d.category, d.visibility].join(" · ")}
              </small>
              {p.description && <p>{p.description}</p>}
              {p.pdf && <a href={p.pdf}>Download PDF</a>}
              {d.url && (
                <a href={d.url} target="_blank" rel="noreferrer">
                  Open document
                </a>
              )}
              {editable && (
                <div className={styles.actions}>
                  {plans && (
                    <>
                      <MuiButton
                        type="button"
                        disabled={busy}
                        onClick={() => open(p)}
                      >
                        Edit
                      </MuiButton>
                      <MuiButton
                        type="button"
                        disabled={busy || index === 0}
                        onClick={() => reorder(index, index - 1)}
                      >
                        Move up
                      </MuiButton>
                      <MuiButton
                        type="button"
                        disabled={busy || index === entries.length - 1}
                        onClick={() => reorder(index, index + 1)}
                      >
                        Move down
                      </MuiButton>
                    </>
                  )}
                  <MuiButton
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Remove " + entry.title + "?"))
                        void run(() =>
                          apiRequest(
                            base +
                              "/" +
                              kind +
                              "/" +
                              entry.id +
                              "?revision=" +
                              assets!.revision,
                            { method: "DELETE" },
                          ),
                        );
                    }}
                  >
                    Remove
                  </MuiButton>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {editing && (
        <fieldset disabled={busy} className={styles.editor}>
          <legend>{plans ? "Marketing floor plan" : "Document details"}</legend>
          {field("title", "Title")}
          {plans ? (
            <>
              {field("planType", "Plan type", floorPlanTypes)}
              {field("configurationLabel", "Configuration")}
              {field("floorLabel", "Floor label")}
              {field("bedrooms", "Bedrooms", undefined, "number")}
              {field("bathrooms", "Bathrooms", undefined, "number")}
              {field("areaValue", "Area", undefined, "number")}
              {field("areaUnit", "Area unit", AREA_UNITS)}
              {field("description", "Description")}
              <label>
                Plan image
                <MaterialInput
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setImage(e.target.files?.[0])}
                />
                <small>{errors.image}</small>
              </label>
              <label>
                Plan PDF
                <MaterialInput
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdf(e.target.files?.[0])}
                />
                <small>{errors.pdf}</small>
              </label>
              <label>
                <MaterialInput
                  type="checkbox"
                  checked={values.isPrimary === "true"}
                  onChange={(e) =>
                    setValues((s) => ({
                      ...s,
                      isPrimary: String(e.target.checked),
                    }))
                  }
                />
                Primary plan
              </label>
            </>
          ) : (
            <>
              {field("category", "Category", propertyDocumentTypes)}
              {field(
                "visibility",
                "Visibility",
                ["Brochure", "Marketing plan"].includes(values.category)
                  ? ["PRIVATE", "PUBLIC"]
                  : ["PRIVATE"],
              )}
              <label>
                Document
                <MaterialInput
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => setDoc(e.target.files?.[0])}
                />
                <small>{errors.file}</small>
              </label>
            </>
          )}
          <small>
            Images up to {(assets?.imageLimit ?? 0) / 1048576} MB · PDFs up to{" "}
            {(assets?.pdfLimit ?? 0) / 1048576} MB
          </small>
          <div className={styles.actions}>
            <MuiButton type="button" onClick={save}>
              {busy ? "Saving…" : "Save " + (plans ? "floor plan" : "document")}
            </MuiButton>
            <MuiButton type="button" onClick={() => setEditing(false)}>
              Cancel
            </MuiButton>
          </div>
        </fieldset>
      )}
      {zoom?.image && <FloorPlanViewer image={zoom.image} title={zoom.title} onClose={()=>setZoom(undefined)}/>}
    </section>
  );
}
