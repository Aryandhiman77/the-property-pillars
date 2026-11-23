"use client";

import {useEffect, useRef, useState, type FormEvent} from "react";
import Link from "next/link";
import Image from "next/image";
import {Eye, Pencil, Plus, Trash2} from "lucide-react";
import toast from "react-hot-toast";
import {articleSocialPlatforms, articleTopicLabels, articleTopics, type ArticleSocialPlatform, type ArticleTopic} from "@the-property-pillar/contracts";
import {LoadingRows} from "@/components/ui/loading-skeleton";
import {listingCountries} from "@/config/listing-geography";
import {ImageUpload} from "@/features/dashboard/image-upload";
import {useMediaDrafts} from "@/features/dashboard/media-drafts";
import {PropertyEditor} from "@/features/dashboard/property-editor";
import {UploadProgress} from "@/features/dashboard/upload-progress";
import {ApiClientError, apiRequest} from "@/lib/api/client";
import styles from "@/features/dashboard/website-panels.module.css";
import {socialIcons} from "./social-icons";
import type {ArticleSocialLink} from "./types";

type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type Draft = {id?: string; title: string; summary: string; coverImage: string; imageAlt: string; bodyHtml: string;
  tags: string; city: string; countryCode: string; propertyType: string; socialLinks: ArticleSocialLink[]; status: Status; topic: ArticleTopic};
type ArticleAdmin = Omit<Draft, "tags"> & {id: string; slug: string; tags: string[]; publishedAt: string | null; readMinutes: number};
type Row = Pick<ArticleAdmin, "id" | "slug" | "title" | "status" | "publishedAt" | "readMinutes" | "topic">;
const statuses = {DRAFT: "Draft", PUBLISHED: "Published", ARCHIVED: "Archived"};
const blank: Draft = {title: "", summary: "", coverImage: "", imageAlt: "", bodyHtml: "", tags: "", city: "", countryCode: "", propertyType: "", socialLinks: [], status: "DRAFT", topic: "NEWS"};

function ArticleDialog({initial, close, onSaved}: {initial: Draft; close: () => void; onSaved: () => void}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const media = useMediaDrafts();
  useEffect(() => {dialog.current?.showModal();}, []);

  function update<Key extends keyof Draft>(key: Key, value: Draft[Key]) {
    setDraft((current) => ({...current, [key]: value}));
    setFields((current) => Object.fromEntries(Object.entries(current).filter(([name]) => name !== key && !name.startsWith(key + "."))));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const {id, tags, countryCode, city, propertyType, ...rest} = draft;
    const issues: Record<string, string> = {};
    if (rest.title.trim().length < 4) issues.title = "Enter at least four characters.";
    if (rest.imageAlt.trim().length < 2) issues.imageAlt = "Describe the cover image.";
    if (!rest.coverImage) issues.coverImage = "Upload a cover image.";
    if (!rest.bodyHtml.replace(/<[^>]+>|&nbsp;/g, "").trim()) issues.bodyHtml = "Enter the article body.";
    setFields(issues); setError("");
    if (Object.keys(issues).length) return;
    setSaving(true); pending.current = true;
    try {
      const parsedTags = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
      await media.save({...rest, tags: parsedTags, countryCode: countryCode || null, city: city || null, propertyType: propertyType || null},
        (body) => apiRequest("/workspace/articles" + (id ? "/" + encodeURIComponent(id) : ""), {method: id ? "PATCH" : "POST", body}));
      toast.success("Article saved");
      onSaved();
    } catch (failure) {
      if (failure instanceof ApiClientError && Object.keys(failure.fieldErrors).length) setFields(failure.fieldErrors);
      else setError(failure instanceof Error ? failure.message : "Could not save the article.");
    } finally {pending.current = false; setSaving(false);}
  }
  const issue = (key: string) => fields[key] && <small id={"article-field-" + key} role="alert">{fields[key]}</small>;
  const attributes = (key: string) => ({"aria-invalid": Boolean(fields[key]), "aria-describedby": fields[key] ? "article-field-" + key : undefined});
  const wide = {gridColumn: "1 / -1"};
  return <dialog ref={dialog} aria-label="Article editor" className={styles.dialog} onCancel={(event) => {event.preventDefault(); if (!saving) close();}}>
    <form className={styles.form} onSubmit={save} noValidate aria-busy={saving}>
      <h2>{draft.id ? "Edit article" : "Add article"}</h2>
      {error && <p className={styles.formError} role="alert">{error}</p>}
      {(["title", "summary", "imageAlt", "tags", "city", "propertyType"] as const).map((key, index) => <label key={key} style={["title", "summary"].includes(key) ? wide : undefined}>
        {["Title", "Summary", "Image alt text", "Tags (comma separated)", "City", "Property type"][index]}
        <input {...attributes(key)} value={draft[key]} maxLength={[160, 350, 160, 600, 100, 80][index]} disabled={saving}
          onChange={(event) => update(key, event.target.value)} />
        {issue(key)}{key === "tags" && Object.keys(fields).filter((name) => name.startsWith("tags.")).map((name) => <small key={name} role="alert">{fields[name]}</small>)}
      </label>)}
      <label>Country or territory<select {...attributes("countryCode")} disabled={saving} value={draft.countryCode} onChange={(event) => update("countryCode", event.target.value)}>
        <option value="">Select a country</option>{listingCountries.map(({value, label}) => <option key={value} value={value}>{label}</option>)}</select>{issue("countryCode")}</label>
      <label>Status<select disabled={saving} value={draft.status} onChange={(event) => update("status", event.target.value as Status)}>
        {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{issue("status")}</label>
      <label>Article category<select {...attributes("topic")} disabled={saving} value={draft.topic} onChange={(event) => update("topic", event.target.value as ArticleTopic)}>
        {articleTopics.map((topic) => <option key={topic} value={topic}>{articleTopicLabels[topic]}</option>)}</select>{issue("topic")}</label>
      <div style={wide}><strong>Cover image</strong><ImageUpload purpose="articles:coverImage" label="Upload cover image" value={draft.coverImage}
        maxFiles={1} onChange={(url) => update("coverImage", url)} drafts={media} disabled={saving} />{issue("coverImage")}</div>
      <div style={wide}><label htmlFor="article-body">Article body</label>
        <PropertyEditor id="article-body" value={draft.bodyHtml} onChange={(value) => update("bodyHtml", value)} {...attributes("bodyHtml")} />
        {issue("bodyHtml")}
      </div>
      <fieldset className={styles.articleSocial} style={wide}><legend>Social media links</legend>
        {draft.socialLinks.map(({platform, url}, index) => {
          const {Icon, color, name} = socialIcons[platform];
          const change = (link: ArticleSocialLink) => update("socialLinks", draft.socialLinks.map((entry, i) => i === index ? link : entry));
          return <div className={styles.articleSocialRow} key={index}><Icon size={22} color={color} aria-label={name} />
            <label>Platform<select value={platform} disabled={saving} {...attributes(`socialLinks.${index}.platform`)} onChange={(event) => change({platform: event.target.value as ArticleSocialPlatform, url})}>
              {articleSocialPlatforms.map((key) => <option key={key} value={key}>{socialIcons[key].name}</option>)}</select>{issue(`socialLinks.${index}.platform`)}</label>
            <label>URL<input type="url" value={url} placeholder="https://" disabled={saving} {...attributes(`socialLinks.${index}.url`)} onChange={(event) => change({platform, url: event.target.value})} />{issue(`socialLinks.${index}.url`)}</label>
            <button type="button" disabled={saving} aria-label={"Remove " + name} onClick={() => update("socialLinks", draft.socialLinks.filter((_, i) => i !== index))}><Trash2 size={17} /></button>
          </div>;
        })}
        {draft.socialLinks.length < articleSocialPlatforms.length && <button type="button" disabled={saving} onClick={() => {
          const platform = articleSocialPlatforms.find((key) => !draft.socialLinks.some((link) => link.platform === key));
          if (platform) update("socialLinks", [...draft.socialLinks, {platform, url: ""}]);
        }}><Plus size={16} aria-hidden="true" /> Add social link</button>}
        {issue("socialLinks")}
      </fieldset>
      {preview && <section className={styles.articlePreview} style={wide}>
        {draft.coverImage && <Image src={draft.coverImage} alt={draft.imageAlt} width={800} height={450} unoptimized />}
        <h2>{draft.title || "Untitled article"}</h2><p>{draft.summary}</p>
        <iframe title="Draft article body" sandbox="" srcDoc={'<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'">' + draft.bodyHtml} />
      </section>}
      <footer>
        <UploadProgress progress={media.progress} />
        <button type="button" disabled={saving} onClick={() => setPreview(!preview)}><Eye size={16} aria-hidden="true" /> {preview ? "Hide preview" : "Preview"}</button>
        <button type="button" disabled={saving} onClick={close}>Cancel</button>
        <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save article"}</button>
      </footer>
    </form>
  </dialog>;
}

export function AdminArticles({locale}: {locale: string}) {
  const [rows, setRows] = useState<{items: Row[]; total: number}>();
  const [editor, setEditor] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    void apiRequest<{items: Row[]; total: number}>("/workspace/articles?page=" + page, {signal: abort.signal}).then((data) => {
      if (!abort.signal.aborted) {setRows(data); setError("");}
    }, (failure: Error) => {if (!abort.signal.aborted) setError(failure.message);});
    return () => abort.abort();
  }, [page, revision]);

  async function open(id: string) {
    setOpening(true); setError("");
    try {
      const article = await apiRequest<ArticleAdmin>("/workspace/articles/" + encodeURIComponent(id));
      const {title, summary, coverImage, imageAlt, bodyHtml, tags, city, countryCode, propertyType, socialLinks, status, topic} = article;
      setEditor({id, title, summary, coverImage, imageAlt, bodyHtml, tags: tags.join(", "), city: city ?? "", countryCode: countryCode ?? "", propertyType: propertyType ?? "", socialLinks, status, topic});
    } catch (failure) {setError(failure instanceof Error ? failure.message : "Could not load this article.");}
    finally {setOpening(false);}
  }
  return <section className={styles.panel}>
    <header><div><h1>Articles</h1><p>Write, preview and publish marketplace articles in English.</p></div><button type="button" disabled={opening} onClick={() => setEditor(blank)}>Add article</button></header>
    {error && <p role="alert">{error} <button type="button" onClick={() => setRevision((current) => current + 1)}>Retry</button></p>}
    {editor && <ArticleDialog initial={editor} close={() => setEditor(null)} onSaved={() => {setEditor(null); setRevision((current) => current + 1);}} />}
    {!rows && !error ? <LoadingRows label="Loading articles" count={4} /> : rows?.items.length ? <ul className={styles.rows}>
      {rows.items.map((row) => <li key={row.id}><div><strong>{row.title}</strong><small>{statuses[row.status]} · {row.readMinutes} min read{row.publishedAt ? " · " + new Intl.DateTimeFormat(locale, {dateStyle: "medium"}).format(new Date(row.publishedAt)) : ""}</small></div>
        {row.status === "PUBLISHED" && <Link href={`/${locale}/articles/${row.slug}`}>View</Link>}
        <button type="button" disabled={opening} onClick={() => void open(row.id)} aria-label={"Edit " + row.title}><Pencil size={17} /> Edit</button>
      </li>)}
    </ul> : !error && <p>No articles yet.</p>}
    {rows && rows.total > 12 && <footer><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
      <span>Page {page}</span><button type="button" disabled={page * 12 >= rows.total} onClick={() => setPage(page + 1)}>Next</button></footer>}
  </section>;
}
