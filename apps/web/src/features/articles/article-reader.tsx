"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import Link from "next/link";
import Image from "next/image";
import {Copy, Eye, Heart, Share2, X} from "lucide-react";
import {useTranslations} from "next-intl";
import {apiRequest, ApiClientError} from "@/lib/api/client";
import {useMarketplaceAuth} from "@/features/auth/marketplace-session";
import {useMobilePrompt} from "@/features/auth/mobile-auth";
import {Skeleton} from "@/components/ui/loading-skeleton";
import {ArticleMeta, ArticleTags} from "./article-cards";
import {articleHeadingEvent} from "./article-header";
import {socialIcons} from "./social-icons";
import type {ArticleDetails} from "./types";
import styles from "./articles.module.css";

function ArticlePage({data, locale, first}: {data: ArticleDetails; locale: string; first: boolean}) {
  const {article} = data;
  const t = useTranslations("Articles");
  const auth = useMarketplaceAuth();
  const mobile = useMobilePrompt();
  const heading = useRef<HTMLHeadingElement>(null);
  const shareDialog = useRef<HTMLDialogElement>(null);
  const liking = useRef(false);
  const [stats, setStats] = useState(data.stats);
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const path = "/public/articles/" + article.id;
  const Heading = first ? "h1" : "h2";
  const number = new Intl.NumberFormat(locale);

  useEffect(() => {
    const element = heading.current;
    if (!element || auth?.state === "loading") return;
    const abort = new AbortController();
    const count = () => void apiRequest<ArticleDetails["stats"]>(path + "/views", {method: "POST", signal: abort.signal})
      .then((result) => {if (!abort.signal.aborted) setStats(result);}, () => {});
    if (!("IntersectionObserver" in window)) {count(); return () => abort.abort();}
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      count();
    }, {threshold: 0.15});
    observer.observe(element);
    return () => {abort.abort(); observer.disconnect();};
  }, [path, auth?.state]);

  async function like() {
    if (liking.current) return;
    liking.current = true;
    setBusy(true); setMessage("");
    try {
      if (!auth?.session && !await mobile.verify({scope: "like:" + article.id})) return;
      setStats(await apiRequest<ArticleDetails["stats"]>(path + "/like", {method: stats.liked ? "DELETE" : "PUT"}));
      if (!auth?.session) void auth?.refresh();
    } catch {setMessage(t("actionFailed"));}
    finally {liking.current = false; setBusy(false);}
  }

  function openShare() {
    setCopied(false); setMessage("");
    setLink(new URL(`/${locale}/articles/${article.slug}`, window.location.origin).href);
    shareDialog.current?.showModal();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setStats(await apiRequest<ArticleDetails["stats"]>(path + "/shares", {method: "POST", body: {eventId: crypto.randomUUID()}}));
    } catch {setMessage(t("actionFailed"));}
  }

  return <article className={styles.reader} aria-labelledby={"article-" + article.slug}>
    <div className={styles.prose}>
      <Image className={styles.cover} src={article.coverImage} alt={article.imageAlt} width={1200} height={675} priority={first} unoptimized />
      <Heading id={"article-" + article.slug} ref={heading} className={styles.title} data-editorial-heading={article.slug} lang={article.contentLocale} dir="auto">{article.title}</Heading>
      <div className={styles.metadata}>
        <ArticleTags tags={article.tags} />
        {article.socialLinks.length > 0 && <ul className={styles.social} aria-label={t("social")}>
          {article.socialLinks.map(({platform, url}) => {
            const {Icon, color, name} = socialIcons[platform];
            return <li key={platform}><a title={name} aria-label={name} href={url} rel="noopener noreferrer" target="_blank"><Icon size={21} color={color} aria-hidden /></a></li>;
          })}
        </ul>}
      </div>
      <ArticleMeta article={article} locale={locale} />
      {article.contentLocale !== locale && <p className={styles.fallback}>{t("englishVersion")}</p>}
      <div lang={article.contentLocale} dir={article.contentLocale === "ar" ? "rtl" : "ltr"} className={styles.richText} dangerouslySetInnerHTML={{__html: article.bodyHtml}} />
    </div>
    <aside className={styles.stats} aria-label={t("stats")}>
      <span><Eye size={20} aria-hidden="true" /><strong>{number.format(stats.views)}</strong>{t("views")}</span>
      <button type="button" aria-pressed={stats.liked} disabled={busy || auth?.state === "loading"} onClick={() => void like()}>
        <Heart size={20} fill={stats.liked ? "currentColor" : "none"} aria-hidden="true" /><strong>{number.format(stats.likes)}</strong>{t("likes")}
      </button>
      <button type="button" onClick={openShare}><Share2 size={20} aria-hidden="true" /><strong>{number.format(stats.shares)}</strong>{t("shares")}</button>
      {message && !shareDialog.current?.open && <small role="status">{message}</small>}
    </aside>
    {data.related.length > 0 && <aside className={styles.related} aria-label={t("related")}>
      <h3>{t("related")}</h3>
      <ul>{data.related.map((item) => <li key={item.id}><Link href={`/${locale}/articles/${item.slug}`} lang={item.contentLocale} dir="auto">{item.title}</Link></li>)}</ul>
    </aside>}
    <dialog className={styles.shareDialog} ref={shareDialog} aria-label={t("shareArticle")} onClose={() => setMessage("")}>
      <header><strong>{t("shareArticle")}</strong><button onClick={() => shareDialog.current?.close()} type="button" aria-label={t("close")}><X size={20} /></button></header>
      <input value={link} readOnly aria-label={t("shareArticle")} onFocus={(event) => event.target.select()} dir="ltr" />
      <button type="button" className="market-button" disabled={copied} onClick={() => void copy()}><Copy size={16} aria-hidden="true" />{t(copied ? "copied" : "copy")}</button>
      {message && <small role="status">{message}</small>}
    </dialog>
    {mobile.dialog}
  </article>;
}

export function ArticleReader({initial, locale}: {initial: ArticleDetails; locale: string}) {
  const t = useTranslations("Articles");
  const [pages, setPages] = useState([initial]);
  const [next, setNext] = useState(initial.next);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const list = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController>(null);
  const activeHeading = useRef("");
  const last = pages.at(-1)!;
  const canLoad = Boolean(next);

  const load = useCallback(async () => {
    if (!next || request.current) return;
    const abort = new AbortController();
    request.current = abort;
    setStatus("loading");
    try {
      const get = (slug: string) => apiRequest<ArticleDetails>(`/public/articles/${encodeURIComponent(slug)}?locale=${locale}`, {signal: abort.signal});
      let page: ArticleDetails;
      try {page = await get(next);}
      catch (failure) {
        if (!(failure instanceof ApiClientError) || failure.status !== 404) throw failure;
        const {slug} = await apiRequest<{slug: string | null}>(`/public/articles/${last.article.slug}/next`, {signal: abort.signal});
        if (!slug) {setNext(null); setStatus("idle"); return;}
        page = await get(slug);
      }
      if (abort.signal.aborted) return;
      setPages((current) => current.some(({article}) => article.slug === page.article.slug) ? current : [...current, page]);
      setNext(page.next === page.article.slug ? null : page.next);
      setStatus("idle");
    } catch {if (!abort.signal.aborted) setStatus("error");}
    finally {if (request.current === abort) request.current = null;}
  }, [last.article.slug, locale, next]);

  useEffect(() => () => {request.current?.abort(); request.current = null;}, []);
  useEffect(() => {
    const trigger = more.current;
    if (!trigger || !canLoad || status !== "idle" || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {if (entry.isIntersecting) void load();});
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [canLoad, load, status]);

  useEffect(() => {
    const heads = Array.from(list.current?.querySelectorAll<HTMLElement>("[data-editorial-heading]") ?? []);
    let frame = 0;
    function update() {
      frame = 0;
      const threshold = 90;
      const current = [...heads].reverse().find((head) => head.getBoundingClientRect().bottom <= threshold)?.dataset.editorialHeading ?? "";
      if (current === activeHeading.current) return;
      activeHeading.current = current;
      const article = pages.find((page) => page.article.slug === current)?.article;
      window.dispatchEvent(new CustomEvent(articleHeadingEvent, {detail: article ? {title: article.title, slug: article.slug, contentLocale: article.contentLocale} : null}));
    }
    function schedule() {if (!frame) frame = requestAnimationFrame(update);}
    schedule();
    window.addEventListener("scroll", schedule, {passive: true});
    window.addEventListener("resize", schedule);
    return () => {cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule);};
  }, [pages]);
  useEffect(() => () => {window.dispatchEvent(new CustomEvent(articleHeadingEvent, {detail: null}));}, []);

  return <div ref={list}>
    {pages.map((page, index) => <div key={page.article.id}>
      {index > 0 && <div className={styles.divider}><span>{t("nextPage")}</span></div>}
      <ArticlePage data={page} locale={locale} first={index === 0} />
    </div>)}
    {next && <div ref={more} className={styles.next}>
      {status === "loading" ? <div role="status" aria-label={t("loading")}><Skeleton className={styles.nextSkeleton} /></div> :
        <button className="market-button" type="button" onClick={() => void load()}>{t(status === "error" ? "retry" : "nextPage")}</button>}
    </div>}
    {!next && pages.length > 1 && <p className={styles.next}>{t("end")}</p>}
  </div>;
}
