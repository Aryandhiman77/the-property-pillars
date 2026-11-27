"use client";

import MuiButton from "@mui/material/Button";

import {useEffect, useId, useState} from "react";
import Image from "next/image";
import Link from "next/link";
import {ArrowRight, ArrowUpRight, Award, ChartNoAxesColumnIncreasing, House, Phone} from "lucide-react";
import {articleTopics, propertyBudgetBoundaries, propertyBudgetTiers, propertyCategoryCards, type ArticleTopic} from "@the-property-pillar/contracts";
import {useTranslations} from "next-intl";
import {Skeleton, SkeletonStatus} from "@/components/ui/loading-skeleton";
import type {ArticleCardData} from "@/features/articles/types";
import {ArticleCard} from "@/features/articles/article-cards";
import {useSiteLocation} from "@/features/location/site-location";
import type {Listing} from "@/features/marketplace/directory";
import {apiRequest} from "@/lib/api/client";
import {imageSource} from "@/lib/image-source";
import {HomeRail} from "./home-rail";
import styles from "./home-sections.module.css";

const categoryIds = Object.keys(propertyCategoryCards) as Array<keyof typeof propertyCategoryCards>;

function useHomeFeed<T>(path: string) {
  const [result, setResult] = useState<{path: string; data: T | null}>();
  useEffect(() => {
    const abort = new AbortController();
    void apiRequest<T>(path, {signal: abort.signal}).then((data) => {
      if (!abort.signal.aborted) setResult({path, data});
    }, () => {if (!abort.signal.aborted) setResult({path, data: null});});
    return () => abort.abort();
  }, [path]);
  return result?.path === path ? result.data : undefined;
}

export function PropertyCategories({locale}: {locale: string}) {
  const heading = useId();
  const t = useTranslations("HomeDiscovery");
  const {place} = useSiteLocation();
  const query = new URLSearchParams();
  if (place?.city) query.set("place", JSON.stringify({kind: "city", value: place.city, country: place.countryCode, context: place.state || undefined}));
  const counts = useHomeFeed<Record<keyof typeof propertyCategoryCards, number>>("/public/properties/categories?" + query);
  return <section className={`market-width ${styles.section} ${styles.compactSection}`} aria-labelledby={heading}>
    <header className={styles.heading}><div><h2 id={heading}>{t("categories")}</h2>{place?.city && <p>{place.city}</p>}</div></header>
    <HomeRail className={styles.categoryRail} label="property categories">
      {categoryIds.map((id) => {
        const filters = new URLSearchParams(query);
        filters.set("types", propertyCategoryCards[id].join(","));
        return <Link key={id} className={`${styles.category} ${styles[id]}`} href={`/${locale}/properties?${filters}`}>
          <div className={styles.categoryCopy}><h3>{t(id)}</h3>
            {counts ? <p>{t("propertyCount", {count: counts[id]})}</p> : counts === undefined ? <Skeleton className={styles.countPlaceholder} /> : null}
          </div>
          <div className={styles.categoryImage} aria-hidden="true">
            <Image src={`/images/property-categories/${id}.png`} alt="" fill sizes="(max-width: 340px) 82vw, (max-width: 963px) 260px, (max-width: 1185px) 27vw, 320px" />
          </div>
        </Link>;
      })}
    </HomeRail>
  </section>;
}

export function FeaturedDealers({locale}: {locale: string}) {
  const heading = useId();
  const t = useTranslations("HomeDiscovery");
  const articleText = useTranslations("Articles");
  const dealers = useHomeFeed<Listing[]>("/public/dealers?featured=1&limit=12");
  if (!dealers?.length) return null;
  const month = new Intl.DateTimeFormat(locale, {month: "short", year: "numeric", timeZone: "UTC"});
  return <section className={`market-width ${styles.section}`} aria-labelledby={heading}>
    <div className={styles.dealersPanel}>
      <header className={styles.heading}>
        <div className={styles.dealerHeading}><span className={styles.medal}><Award size={29} aria-hidden="true" /></span>
          <div><h2 id={heading}>{t("featuredDealers")}</h2><p>{t("dealerDescription")}</p></div>
        </div>
        <Link className={styles.sectionLink} href={`/${locale}/dealers?featured=1`}>{t("viewAll")} <ArrowUpRight size={17} aria-hidden="true" /></Link>
      </header>
      <HomeRail className={styles.dealerRail} label="featured dealers">
        {dealers.map(({id, data, title}) => {
          const dealer = String(data.slug || id);
          const profile = `/${locale}/dealer/${encodeURIComponent(dealer)}`;
          const logo = imageSource(data.logoUrl);
          const name = String(data.dealerName || title);
          const agency = typeof data.agencyName === "string" && data.agencyName !== name ? data.agencyName : "";
          const activeSince = typeof data.memberSince === "string" ? month.format(new Date(data.memberSince)) : null;
          const count = Number(data.propertyCount) || 0;
          const enquiries = Number(data.weeklyEnquiries) || 0;
          return <article key={id} className={styles.dealer}>
            <div className={styles.dealerCard}>
              <span className={styles.dealerActivity}>{enquiries > 0 ? <><Phone size={12} aria-hidden="true" />{t("weeklyEnquiries", {count: enquiries})}</> : <><Award size={13} aria-hidden="true" />{t("featuredDealer")}</>}</span>
              <Link href={profile} className={styles.dealerIdentity}>
                <span className={styles.dealerAvatar}>{logo ? <Image src={logo} alt="" fill sizes="96px" unoptimized /> : name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}
                  <span className={styles.avatarMedal}><Award size={17} aria-hidden="true" /></span>
                </span>
                {agency && <span className={styles.dealerAgency}>{agency}</span>}
                <h3>{name}</h3>
              </Link>
              {activeSince && <p>{t("memberSince", {date: activeSince})}</p>}
              <Link className={styles.dealerContact} href={profile + "#property-actions"}>{articleText("contactDealer")}</Link>
            </div>
            <Link className={styles.dealerListings} href={`/${locale}/properties?${new URLSearchParams({dealer})}`}>
              <span className={styles.listingsIcon}><House size={19} aria-hidden="true" /></span>
              <span>{t("propertyCount", {count})}</span><ArrowRight size={16} aria-hidden="true" />
            </Link>
          </article>;
        })}
      </HomeRail>
    </div>
  </section>;
}

export function BrowseByBudget({locale}: {locale: string}) {
  const heading = useId();
  const t = useTranslations("HomeDiscovery");
  const {midStarts, luxuryAbove} = propertyBudgetBoundaries;
  const price = new Intl.NumberFormat(locale === "en" ? "en-IN" : locale, {style: "currency", currency: "INR", maximumFractionDigits: 0});
  const ranges = [`< ${price.format(midStarts)}`, `${price.format(midStarts)} – ${price.format(luxuryAbove)}`, `> ${price.format(luxuryAbove)}`];
  return <section className={`market-width ${styles.section}`} aria-labelledby={heading}>
    <div className={styles.budgetPanel}>
      <div className={styles.budgetLead}><span className={styles.budgetArtwork} aria-hidden="true"><ChartNoAxesColumnIncreasing size={64} /><House size={55} /></span>
        <p>{t("budgetPrompt")}</p></div>
      <div className={styles.budgetCard}>
        <header><h2 id={heading}>{t("budget")}</h2><p>{t("budgetDescription")}</p></header>
        {propertyBudgetTiers.map((budget, i) => <Link key={budget} className={styles.budgetRow}
          href={`/${locale}/properties?${new URLSearchParams({budget, intent: "SALE", currency: "INR"})}`}>
          <span className={styles.rupeeMedallion} aria-hidden="true">{"₹".repeat(i + 1)}</span>
          <span><strong>{t(budget)}</strong><small><bdi>{ranges[i]}</bdi> / {t("sqft")}</small></span><ArrowRight size={18} aria-hidden="true" />
        </Link>)}
      </div>
    </div>
  </section>;
}

type ArticleFeed = {items: ArticleCardData[]; total: number};

function HomeArticleFeed({locale, topic}: {locale: string; topic: ArticleTopic}) {
  const t = useTranslations("Articles");
  const feed = useHomeFeed<ArticleFeed>(`/public/articles?${new URLSearchParams({locale, topic, limit: "12"})}`);
  if (feed === undefined) return <SkeletonStatus label={t("title")} className={styles.articleLoading}>
    {Array.from({length: 4}, (_, index) => <Skeleton key={index} />)}
  </SkeletonStatus>;
  if (!feed?.items.length) return <p className={styles.articleEmpty} role="status">{t(feed ? "empty" : "actionFailed")}</p>;
  return <HomeRail className={styles.articleRail} label="articles">
    {feed.items.map((article) => <ArticleCard key={article.id} article={article} locale={locale} compact />)}
  </HomeRail>;
}

export function TopHomeArticles({locale}: {locale: string}) {
  const heading = useId();
  const t = useTranslations("HomeDiscovery");
  const [selected, setSelected] = useState<ArticleTopic>();
  const recent = useHomeFeed<ArticleFeed>(`/public/articles?${new URLSearchParams({locale, limit: "12"})}`);
  if (!recent?.items.length) return null;
  const topic = selected ?? (recent.items.some((article) => article.topic === "NEWS") ? "NEWS" : recent.items[0].topic);
  return <section className={`market-width ${styles.section} ${styles.editorial}`} aria-labelledby={heading}>
    <header className={styles.heading}>
      <h2 id={heading}>{t("articles")}</h2>
      <Link className={styles.sectionLink} href={`/${locale}/articles`}>{t("articleLink")} <ArrowUpRight size={17} aria-hidden="true" /></Link>
    </header>
    <div className={styles.articleTabs} role="group" aria-label={t("articleCategories")}>
      {articleTopics.map((key) => <MuiButton key={key} type="button" aria-pressed={key === topic} onClick={() => setSelected(key)}>{t(key)}</MuiButton>)}
    </div>
    <div key={topic} className={styles.issueFeed}><HomeArticleFeed locale={locale} topic={topic} /></div>
  </section>;
}
