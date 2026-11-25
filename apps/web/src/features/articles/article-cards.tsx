"use client";

import MuiButton from "@mui/material/Button";

import {useRef} from "react";
import Image from "next/image";
import Link from "next/link";
import {ArrowRight} from "lucide-react";
import {useTranslations} from "next-intl";
import type {ArticleCardData} from "./types";
import styles from "./articles.module.css";

export function ArticleTags({tags}: {tags: string[]}) {
  return tags.length > 0 && <ul className={styles.tags} aria-label="Tags">{tags.map((tag, index) => <li key={index}>{tag}</li>)}</ul>;
}

export function ArticleMeta({article, locale}: {article: ArticleCardData; locale: string}) {
  const t = useTranslations("Articles");
  return <p className={styles.meta}>{t("readTime", {count: article.readMinutes})}<span aria-hidden="true"> · </span>
    <time dateTime={article.publishedAt}>{new Intl.DateTimeFormat(locale, {dateStyle: "medium", timeZone: "UTC"}).format(new Date(article.publishedAt))}</time>
  </p>;
}

export function ArticleCard({article, locale, compact = false, showSummary = false}: {
  article: ArticleCardData; locale: string; compact?: boolean; showSummary?: boolean;
}) {
  const t = useTranslations("Articles");
  return <article className={compact ? styles.compactCard : styles.card}>
    <Link href={`/${locale}/articles/${article.slug}`} lang={article.contentLocale} dir="auto">
      <Image src={article.coverImage} alt={article.imageAlt} width={640} height={365} unoptimized />
      <h3>{article.title}</h3>
    </Link>
    {showSummary && article.summary && <p lang={article.contentLocale} dir="auto">{article.summary}</p>}
    {compact ? <time className={styles.meta} dateTime={article.publishedAt}>{new Intl.DateTimeFormat(locale, {dateStyle: "medium", timeZone: "UTC"}).format(new Date(article.publishedAt))}</time> : <>
    <ArticleTags tags={article.tags} />
    <ArticleMeta article={article} locale={locale} />
    {locale !== "en" && article.contentLocale === "en" && <small className={styles.meta}>{t("englishVersion")}</small>}
    </>}
  </article>;
}

export function propertyArticlesPath(locale: string, data: Record<string, unknown>) {
  const query = new URLSearchParams({locale, limit: "8"});
  for (const [key, value] of [["city", data.city], ["type", data.propertyType], ["country", data.countryCode]]) {
    if (typeof key === "string" && typeof value === "string" && value) query.set(key, value.slice(0, key === "city" ? 100 : key === "country" ? 2 : 80));
  }
  return "/public/articles?" + query;
}

export function PropertyArticles({locale, articles}: {locale: string; articles: ArticleCardData[]}) {
  const t = useTranslations("Articles");
  const rail = useRef<HTMLDivElement>(null);
  if (!articles.length) return null;
  return <section className={styles.interesting}>
    <header className={styles.sectionHeader}><h2>{t("interesting")}</h2>
      <Link className="market-text-link" href={`/${locale}/articles`}>{t("viewAll")} <ArrowRight size={17} aria-hidden="true" /></Link></header>
    <div className={styles.carousel}>
      <div className={styles.rail} ref={rail}>{articles.map((article) => <ArticleCard key={article.id} article={article} locale={locale} />)}</div>
      {articles.length > 1 && <MuiButton className={styles.railNext} type="button" aria-label={t("more")} onClick={() => {
        const element = rail.current;
        if (!element) return;
        const rtl = getComputedStyle(element).direction === "rtl";
        const atEnd = Math.abs(element.scrollLeft) >= element.scrollWidth - element.clientWidth - 4;
        const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
        if (atEnd) element.scrollTo({left: 0, behavior});
        else element.scrollBy({left: element.clientWidth * (rtl ? -1 : 1), behavior});
      }}><ArrowRight size={19} aria-hidden="true" /></MuiButton>}
    </div>
  </section>;
}
