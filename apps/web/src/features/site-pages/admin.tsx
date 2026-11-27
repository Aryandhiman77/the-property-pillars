"use client";

import {useEffect, useState} from "react";
import Link from "next/link";
import {sitePageTitles, type SitePage, type SitePageSlug} from "@the-property-pillar/contracts";
import {apiRequest} from "@/lib/api/client";
import {PropertyEditor} from "@/features/dashboard/property-editor";
import styles from "./pages.module.css";

export function SitePagesPanel({locale}: {locale: string}) {
  const [slug, setSlug] = useState<SitePageSlug>("about");
  const [page, setPage] = useState<SitePage>();
  const [saved, setSaved] = useState<SitePage>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [attempt, retry] = useState(0);
  const dirty = !!page && (page.title !== saved?.title || page.body !== saved.body);
  useEffect(() => {
    const controller = new AbortController();
    setPage(undefined);
    setSaved(undefined);
    setMessage("");
    apiRequest<SitePage>("/workspace/site-pages/" + slug, {signal: controller.signal}).then(data => {
      if (!controller.signal.aborted) {setPage(data); setSaved(data);}
    }).catch(error => {if (!controller.signal.aborted) setMessage(error.message);});
    return () => controller.abort();
  }, [slug, attempt]);
  async function publish() {
    if (!page || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const data = await apiRequest<SitePage>("/workspace/site-pages/" + slug, {
        method: "PUT", body: {title: page.title, body: page.body, revision: page.revision},
      });
      setPage(data); setSaved(data); setMessage("Page published.");
    } catch (e) {setMessage(e instanceof Error ? e.message : "Could not save the page.");}
    finally {setBusy(false);}
  }
  function mayDiscard() {return !dirty || window.confirm("Discard unsaved page changes?");}
  return <section className={styles.editor}>
    <h2>Website pages</h2>
    <label>Choose a page<select value={slug} disabled={busy} onChange={e => {
      if (mayDiscard()) {setPage(undefined); setSlug(e.target.value as SitePageSlug);}
    }}>{Object.entries(sitePageTitles).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    {page && <form onSubmit={e => {e.preventDefault(); void publish();}}>
      <fieldset disabled={busy}><label>Page title<input required maxLength={150} value={page.title} onChange={e => setPage({...page,title:e.target.value})}/></label>
      <label htmlFor="policy-body">Page content</label><PropertyEditor key={slug + ":" + attempt} id="policy-body" value={page.body} onChange={body => setPage(current => current ? {...current,body} : current)}/></fieldset>
      <div className={styles.actions}><button type="submit" disabled={busy || !dirty}>{busy ? "Publishing…" : "Publish changes"}</button>
      <Link href={`/${locale}/info/${slug}`} target="_blank" rel="noreferrer">View public page ↗</Link></div>
    </form>}
    {message && <p role="status">{message}</p>}
    <button type="button" disabled={busy} onClick={() => {if (mayDiscard()) retry(n => n + 1);}}>Reload saved version</button>
  </section>;
}
