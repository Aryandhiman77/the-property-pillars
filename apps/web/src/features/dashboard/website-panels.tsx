"use client";

import {useEffect, useRef, useState, type FormEvent} from "react";
import {leadVisitorLabels, type LeadVisitorType} from "@the-property-pillar/contracts";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import {ApiClientError, apiRequest} from "@/lib/api/client";
import {ImageUpload} from "./image-upload";
import {useMediaDrafts} from "./media-drafts";
import {UploadProgress} from "./upload-progress";
import styles from "./website-panels.module.css";
import dashboard from "./dashboard.module.css";

export type Slide = {
  id: string; title: string; description: string | null; imageUrl: string; videoUrl: string | null;
  imageAlt: string; ctaLabel: string | null; ctaHref: string | null; sortOrder: number; status: "DRAFT" | "PUBLISHED" | "PAUSED" | "ARCHIVED";
};
const blank: Slide = {id: "", title: "", description: "", imageUrl: "", videoUrl: "", imageAlt: "", ctaLabel: "", ctaHref: "", sortOrder: 0, status: "DRAFT"};
const slideStatuses: Record<Slide["status"], Slide["status"][]> = {
  DRAFT: ["DRAFT", "PUBLISHED", "ARCHIVED"], PUBLISHED: ["PUBLISHED", "PAUSED", "ARCHIVED"], PAUSED: ["PAUSED", "PUBLISHED", "ARCHIVED"], ARCHIVED: ["ARCHIVED"],
};
const display = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

function BannerThumbnail({slide}: {slide: Slide}) {
  const [failedUrl, setFailedUrl] = useState("");
  return slide.imageUrl && slide.imageUrl !== failedUrl
    ? <Image className={styles.bannerThumb} unoptimized width={112} height={63} src={slide.imageUrl}
        alt={slide.imageAlt || slide.title} onError={() => setFailedUrl(slide.imageUrl)} />
    : <span className={styles.bannerUnavailable}>Image unavailable</span>;
}

export function HomepageSlidesPanel() {
  const [rows, setRows] = useState<Slide[] | null>(null);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<Slide | null>(null);
  const [currentStatus, setCurrentStatus] = useState<Slide["status"]>("DRAFT");
  const [pending, setPending] = useState(false);
  const media = useMediaDrafts();
  const [invalid, setInvalid] = useState<Record<string, string>>({});
  const [refresh, setRefresh] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const editOpen = edit !== null;
  useEffect(() => {if (editOpen && dialog.current && !dialog.current.open) dialog.current.showModal();}, [editOpen]);
  useEffect(() => {
    const abort = new AbortController();
    void apiRequest<Slide[]>("/workspace/homepage-slides", {signal: abort.signal}).then((result) => {
      if (!abort.signal.aborted) {setRows(result); setError("");}
    }, (failure: Error) => {if (!abort.signal.aborted) setError(failure.message);});
    return () => abort.abort();
  }, [refresh]);
  function open(row: Slide) {setEdit(row); setCurrentStatus(row.status); setInvalid({}); setError("");}
  function close() {media.reset(); setEdit(null);}
  function update<K extends keyof Slide>(key: K, value: Slide[K]) {
    setEdit((current) => current ? {...current, [key]: value} : current);
    setInvalid((current) => ({...current, [key]: ""}));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edit || pending) return;
    const missing: Record<string, string> = {};
    if (!edit.title.trim()) missing.title = "Enter a title.";
    if (!edit.imageUrl) missing.imageUrl = "Upload an image or video poster.";
    if (!edit.imageAlt.trim()) missing.imageAlt = "Enter image alt text.";
    setInvalid(missing);
    if (Object.keys(missing).length) return;
    setPending(true);
    setError("");
    const {id, title, description, status, sortOrder, imageUrl, imageAlt, videoUrl, ctaLabel, ctaHref} = edit;
    try {
      await media.save({title, description: description?.trim() || null, status, sortOrder: sortOrder || undefined, imageUrl, imageAlt,
        videoUrl: videoUrl || null, ctaLabel: ctaLabel?.trim() || null, ctaHref: ctaHref?.trim() || null},
      (body) => apiRequest("/workspace/homepage-slides" + (id ? "/" + encodeURIComponent(id) : ""), {method: id ? "PATCH" : "POST", body}));
      toast.success("Homepage slide saved");
      close();
      setRefresh((value) => value + 1);
    } catch (failure) {
      if (failure instanceof ApiClientError && Object.keys(failure.fieldErrors).length) setInvalid(failure.fieldErrors);
      else setError(failure instanceof Error ? failure.message : "Could not save this slide.");
    } finally {setPending(false);}
  }
  const fail = (key: string) => invalid[key] && <small role="alert" id={"slide-" + key}>{invalid[key]}</small>;
  function field(key: "title" | "imageAlt" | "ctaLabel" | "ctaHref", label: string, placeholder: string) {
    return <label>{label}<input value={edit?.[key] ?? ""} placeholder={placeholder}
      required={key === "title" || key === "imageAlt"} aria-invalid={Boolean(invalid[key])}
      aria-describedby={invalid[key] ? "slide-" + key : undefined}
      onChange={(event) => update(key, event.target.value)} />{fail(key)}</label>;
  }
  return <section className={styles.panel}>
    <header><div><h1>Homepage Carousel</h1><p>Publish and order the slides shown on the marketplace homepage.</p></div>
      <button type="button" onClick={() => open(blank)}>Add slide</button></header>
    {error && <p role="alert">{error} {!edit && <button type="button" onClick={() => setRefresh((value) => value + 1)}>Retry</button>}</p>}
    {edit && <dialog className={styles.slideDialog} ref={dialog} aria-label={edit.id ? "Edit homepage slide" : "Add homepage slide"}
      onCancel={(event) => {event.preventDefault(); if (!pending) close();}}>
      <form onSubmit={save} noValidate className={styles.slideForm} aria-label={edit.id ? "Edit homepage slide" : "Add homepage slide"}>
      <header><h2>{edit.id ? "Edit homepage slide" : "Add homepage slide"}</h2></header>
      <div className={styles.slideBody}>
      {error && <p role="alert" className={styles.formError}>{error}</p>}
      <fieldset disabled={pending}><legend>Slide content</legend>
        {field("title", "Title *", "Headline on the homepage")}
        <label>Description<textarea rows={2} value={edit.description ?? ""} onChange={(event) => update("description", event.target.value)} aria-invalid={Boolean(invalid.description)} aria-describedby={invalid.description ? "slide-description" : undefined} />{fail("description")}</label>
      </fieldset>
      <fieldset disabled={pending}><legend>Media</legend><div className={styles.fieldPair}>
        <div><strong>Cover image / video poster *</strong><ImageUpload label="Slide image" purpose="homepageSlides:imageUrl" value={edit.imageUrl} maxFiles={1} onChange={(value) => update("imageUrl", value)} drafts={media} disabled={pending} />{fail("imageUrl")}</div>
        <div><strong>Video (optional)</strong><ImageUpload label="Slide video" purpose="homepageSlides:videoUrl" value={edit.videoUrl ?? ""} maxFiles={1} kind="video" onChange={(value) => update("videoUrl", value)} drafts={media} disabled={pending} />{fail("videoUrl")}</div>
      </div>{field("imageAlt", "Image alt text *", "Describe the cover image")}</fieldset>
      <fieldset disabled={pending}><legend>Slide button (optional)</legend><div className={styles.fieldPair}>
        {field("ctaLabel", "Button label", "Explore properties")}
        {field("ctaHref", "Button link", "/en/properties")}
      </div></fieldset>
      <fieldset disabled={pending}><legend>Publishing</legend><div className={styles.fieldPair}>
      <label>Sort order<input type="number" min={1} value={edit.sortOrder || ""} placeholder="Next position" onChange={(event) => update("sortOrder", Number(event.target.value))} />{fail("sortOrder")}</label>
      <label>Status<select value={edit.status} onChange={(event) => update("status", event.target.value as Slide["status"])}>{slideStatuses[currentStatus].filter((status) => edit.id || status !== "ARCHIVED").map((status) => <option value={status} key={status}>{display(status)}</option>)}</select>{fail("status")}</label>
      </div></fieldset></div>
      <footer><UploadProgress progress={media.progress} /><button type="button" disabled={pending} onClick={close}>Cancel</button><button disabled={pending} type="submit">{pending ? "Saving…" : "Save slide"}</button></footer>
    </form></dialog>}
    {!rows && !error ? <p role="status">Loading slides…</p> : rows?.length ? (
      <div className={styles.slideTableWrap} role="region" aria-label="Slide list" tabIndex={0}>
        <table className={styles.slideTable} aria-label="Homepage carousel slides">
          <thead><tr><th scope="col">Banner</th><th scope="col">Slide title</th><th scope="col">Status</th>
            <th scope="col">Position</th><th scope="col">Actions</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}>
            <td><BannerThumbnail slide={row} /></td>
            <th scope="row">{row.title}</th>
            <td><span className={`${dashboard.status} ${row.status === "PUBLISHED" ? dashboard.statusGood : row.status === "PAUSED" ? dashboard.statusWarm : dashboard.statusNeutral}`}>{display(row.status)}</span></td>
            <td>{row.sortOrder}</td>
            <td>{row.status === "ARCHIVED" ? <span aria-label="No actions available">—</span>
              : <button type="button" onClick={() => open(row)} aria-label={"Edit " + row.title}>Edit</button>}</td>
          </tr>)}</tbody>
        </table>
      </div>
    ) : !error && <p>No homepage slides yet.</p>}
  </section>;
}

type LeadStatus = "NEW" | "CONTACTED" | "CLOSED" | "SPAM";
type Lead = {id: string; title: string; propertyId: string; fullName: string; phone: string; status: LeadStatus; isDealer: boolean; visitorType?: LeadVisitorType; createdAt: string};
const leadStatuses: Record<LeadStatus, LeadStatus[]> = {NEW: ["CONTACTED", "SPAM"], CONTACTED: ["CLOSED", "SPAM"], CLOSED: [], SPAM: []};

export function PropertyMapLeads({locale}: {locale: string}) {
  const [data, setData] = useState<{items: Lead[]; total: number} | null>(null);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    const params = new URLSearchParams({page: String(page)});
    if (status) params.set("status", status);
    void apiRequest<{items: Lead[]; total: number}>("/workspace/property-map-leads?" + params, {signal: abort.signal})
      .then((result) => {if (!abort.signal.aborted) {setError(""); setData(result);}},
        (failure: Error) => {if (!abort.signal.aborted) setError(failure.message);});
    return () => abort.abort();
  }, [status, page, retry]);
  async function change(item: Lead, next: LeadStatus) {
    setSaving(item.id);
    try {
      await apiRequest("/workspace/property-map-leads/" + encodeURIComponent(item.id), {method: "PATCH", body: {status: next}});
      toast.success("Lead status saved");
      setRetry((value) => value + 1);
    } catch (failure) {setError(failure instanceof Error ? failure.message : "The lead could not be changed.");}
    finally {setSaving("");}
  }
  return <section className={styles.panel}><header><div><h1>Leads</h1><p>Map unlock enquiries for your properties.</p></div>
    <label>Status <select value={status} onChange={(event) => {setPage(1); setStatus(event.target.value);}}><option value="">All statuses</option>
      {Object.keys(leadStatuses).map((value) => <option value={value} key={value}>{display(value)}</option>)}</select></label></header>
    {error && <p role="alert">{error} <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></p>}
    {!data && !error && <p role="status">Loading map leads…</p>}
    {data && <><h2>Map unlocks</h2>{data.items.length ? <ul className={styles.rows}>
      {data.items.map((item) => <li key={item.id}><div><strong>{item.fullName}</strong><a href={"tel:" + item.phone}>{item.phone}</a>
        <small>{item.visitorType ? leadVisitorLabels[item.visitorType] : item.isDealer ? leadVisitorLabels.DEALER : "Unspecified"} · {new Intl.DateTimeFormat(locale, {dateStyle: "medium", timeStyle: "short"}).format(new Date(item.createdAt))}</small>
        <Link href={`/${locale}/properties/${encodeURIComponent(item.propertyId)}`}>{item.title}</Link></div>
        <label>Status <select aria-label={"Status for " + item.fullName} value={item.status} disabled={saving === item.id || !leadStatuses[item.status].length}
          onChange={(event) => void change(item, event.target.value as LeadStatus)}>{[item.status, ...leadStatuses[item.status]].map((value) => <option value={value} key={value}>{display(value)}</option>)}</select></label>
      </li>)}
    </ul> : <p>No map unlocks found.</p>}
    {data.total > 25 && <footer><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button type="button" disabled={page * 25 >= data.total} onClick={() => setPage(page + 1)}>Next</button></footer>}</>}
  </section>;
}
