"use client";

import {useEffect, useState} from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {LoadingRows} from "@/components/ui/loading-skeleton";
import {apiRequest} from "@/lib/api/client";
import styles from "./website-panels.module.css";

type Comment = {id: string; fullName: string; body: string; hidden: boolean; createdAt: string; property: {id: string; title: string}};

export function PropertyCommentModeration({locale}: {locale: string}) {
  const [items, setItems] = useState<Comment[]>();
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const path = "/workspace/property-comments";

  useEffect(() => {
    const abort = new AbortController();
    setError("");
    setItems(undefined);
    void apiRequest<{items: Comment[]; hasMore: boolean}>(path + "?page=" + page, {signal: abort.signal})
      .then((data) => {
        if (abort.signal.aborted) return;
        setItems(data.items);
        setHasMore(data.hasMore);
      }, () => {if (!abort.signal.aborted) setError("Could not load property comments.");});
    return () => abort.abort();
  }, [page, refresh]);

  async function update(comment: Comment) {
    setBusy(comment.id);
    try {
      const {hidden} = await apiRequest<{hidden: boolean}>(path + "/" + encodeURIComponent(comment.id), {method: "PATCH", body: {hidden: !comment.hidden}});
      setItems((current) => current?.map((item) => item.id === comment.id ? {...item, hidden} : item));
      toast.success(hidden ? "Comment hidden." : "Comment restored.");
    } catch (cause) {toast.error(cause instanceof Error ? cause.message : "Could not update the comment.");}
    finally {setBusy("");}
  }

  return <section className={styles.panel}>
    <header><div><h1>Property comments</h1><p>Manage comments shown on property listings.</p></div></header>
    {error ? <p role="alert">{error} <button type="button" onClick={() => setRefresh((value) => value + 1)}>Retry</button></p>
      : !items ? <LoadingRows count={3} label="Loading comments" />
        : items.length ? <ul className={styles.rows}>{items.map((item) => <li key={item.id}>
          <div><strong>{item.fullName}</strong><p>{item.body}</p>
            <small>{item.hidden ? "Hidden" : "Public"} · <time dateTime={item.createdAt}>{new Intl.DateTimeFormat(locale, {dateStyle: "medium"}).format(new Date(item.createdAt))}</time></small>
            <Link href={`/${locale}/properties/${encodeURIComponent(item.property.id)}`}>{item.property.title}</Link>
          </div>
          <button type="button" disabled={Boolean(busy)} onClick={() => void update(item)}>{item.hidden ? "Restore comment" : "Hide comment"}</button>
        </li>)}</ul> : <p>No property comments on this page.</p>}
    {items && (page > 1 || hasMore) && <footer>
      <button type="button" disabled={page === 1 || Boolean(busy)} onClick={() => setPage(page - 1)}>Previous</button>
      <span>Page {page}</span>
      <button type="button" disabled={!hasMore || Boolean(busy)} onClick={() => setPage(page + 1)}>Next</button>
    </footer>}
  </section>;
}
