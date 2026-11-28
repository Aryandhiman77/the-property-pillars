import {Suspense} from "react";
import {LoadingRows} from "@/components/ui/loading-skeleton";
import Link from "next/link";
import {notFound} from "next/navigation";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {articleTopics} from "@the-property-pillar/contracts";
import {isAppLocale} from "@/i18n/config";
import {MarketplaceBreadcrumbs, MarketplaceShell} from "@/features/marketplace/marketplace-shell";
import {ArticleCard} from "@/features/articles/article-cards";
import {publicArticleRequest} from "@/features/articles/article-api";
import type {ArticleCardData} from "@/features/articles/types";
import styles from "@/features/articles/articles.module.css";
import home from "@/features/home/home-sections.module.css";

export const dynamic = "force-dynamic";

export default async function ArticlesIndex({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{page?: string; topic?: string}>;
}) {
  const {locale} = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const query = await searchParams;
  const page = Math.max(1, Math.min(1000, Number.parseInt(query.page ?? "1", 10) || 1));
  const topic = articleTopics.find((option) => option === query.topic);
  const href = `/${locale}/articles`;
  const [t, topics] = await Promise.all([getTranslations("Articles"), getTranslations("HomeDiscovery")]);
  return <MarketplaceShell locale={locale}>
    <MarketplaceBreadcrumbs locale={locale} current={t("title")} />
    <header className={styles.indexHeading}><h1>{t("title")}</h1><p>{t("description")}</p></header>
    <nav className={home.articleTabs} aria-label={t("title")}>
      <Link href={href} aria-current={topic ? undefined : "page"}>{t("viewAll")}</Link>
      {articleTopics.map((option) => <Link key={option} href={href + "?topic=" + option} aria-current={option === topic ? "page" : undefined}>{topics(option)}</Link>)}
    </nav>
    <Suspense key={page + ":" + topic} fallback={<LoadingRows label="Loading articles" count={4}/>}>
      <ArticleResults locale={locale} topic={topic} page={page}/>
    </Suspense>
  </MarketplaceShell>;
}

async function ArticleResults({locale, topic, page}: {locale: string; topic?: string; page: number}) {
  const t = await getTranslations("Articles");
  const href = `/${locale}/articles`;
  const feed = await publicArticleRequest<{items: ArticleCardData[]; total: number}>(`?locale=${locale}&page=${page}${topic ? "&topic=" + topic : ""}`).catch(() => null);
  const pageHref = (number: number) => href + "?" + new URLSearchParams({...(topic ? {topic} : {}), page: String(number)});
  return <>
    {!feed ? <p role="status">{t("actionFailed")}</p> : feed.items.length ?
      <div className={styles.indexGrid}>{feed.items.map((article) => <ArticleCard key={article.id} article={article} locale={locale} compact />)}</div> :
      <p>{t("empty")}</p>}
    {feed && feed.total > 12 && <nav className={styles.pagination} aria-label={t("title")}>
      {page > 1 && <Link className="market-text-link" href={pageHref(page - 1)}>{t("previous")}</Link>}
      {page * 12 < feed.total && <Link className="market-text-link" href={pageHref(page + 1)}>{t("nextPage")}</Link>}
    </nav>}
  </>;
}
