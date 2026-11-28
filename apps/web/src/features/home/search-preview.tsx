"use client";

import {useEffect, useState} from "react";
import Link from "next/link";
import {useTranslations} from "next-intl";
import {apiRequest} from "@/lib/api/client";
import styles from "./market-search.module.css";

type Hit = {id: string; title?: string; slug?: string; name?: string; cityName?: string; data?: {city?: string; locality?: string; projectOrSociety?: string}};

export function SearchPreview({locale, route, query}: {locale: string; route: string; query: string}) {
  const t = useTranslations("Site");
  const projects = route === "projects";
  const path = projects ? `/public/new-projects?${query}` : `/public/${route}/search?${query}&limit=3`;
  const [response, setResponse] = useState<{path: string; page: {total: number; items: Hit[]} | null}>();
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void apiRequest<{total: number; items: Hit[]}>(path, {signal: controller.signal})
        .then(page => {if (!controller.signal.aborted) setResponse({path, page});})
        .catch(() => {if (!controller.signal.aborted) setResponse({path, page: null});});
    }, 280);
    return () => {clearTimeout(timer); controller.abort();};
  }, [path]);
  const page = response?.path === path ? response.page : undefined;
  return <section className={styles.preview} aria-busy={page === undefined}>
    <strong role="status">{page === undefined ? t("searchingListings") : page === null ? t("resultsUnavailable") :
      t(route === "properties" ? "listingCount" : "results", {count: page.total})}</strong>
    {page && page.items.length > 0 && <ul>{page.items.slice(0, 3).map(item => <li key={item.id}>
      <Link href={`/${locale}/${route}/${encodeURIComponent(projects ? item.slug || item.id : item.id)}`}>
        {item.title || item.name}<small>{[item.data?.projectOrSociety, item.data?.locality, item.data?.city || item.cityName].filter(Boolean).join(", ")}</small>
      </Link>
    </li>)}</ul>}
  </section>;
}
