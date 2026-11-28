"use client";

import MuiButton from "@mui/material/Button";

import {useEffect, useId, useState} from "react";
import Image from "next/image";
import Link from "next/link";
import {BadgeCheck, ArrowRight, ArrowUpRight, ChartNoAxesColumnIncreasing, House} from "lucide-react";
import {articleTopics, propertyBudgetBoundaries, propertyBudgetTiers, propertyCategoryCards, type ArticleTopic} from "@the-property-pillar/contracts";
import {useTranslations} from "next-intl";
import {Skeleton, SkeletonStatus} from "@/components/ui/loading-skeleton";
import type {ArticleCardData} from "@/features/articles/types";
import {ArticleCard} from "@/features/articles/article-cards";
import {useSiteLocation} from "@/features/location/site-location";
import type {Listing} from "@/features/marketplace/directory";
import {apiRequest} from "@/lib/api/client";
import {imageSource} from "@/lib/image-source";
import {FeaturedProfileSection, type FeaturedCard} from "./featured-profile-section";
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
  return <section className={`market-width market-architecture-backdrop ${styles.section} ${styles.compactSection}`} aria-labelledby={heading}>
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

type BuilderCard = {id:string;name:string;logo:string|null;cover:string|null;count:number;cities:number;projects:number;
  location:string|null;established:number|null;verified:boolean;featured:boolean};

function BuilderLogo({src,name}:{src:string;name:string}){
  const [failed,setFailed]=useState("");
  return <span className={styles.builderLogo}>{src && src!==failed
    ? <Image src={src} width={66} height={66} alt="" unoptimized onError={()=>setFailed(src)}/>
    : name.split(/\s+/).slice(0,2).map(word=>word[0]).join("")}</span>;
}

export function TopBuilders({locale}: {locale: string}) {
  const builders = useHomeFeed<BuilderCard[]>("/public/top-builders");
  if (builders === null || builders?.length === 0) return null;
  return <section className={`market-width ${styles.builderSection}`} aria-labelledby="top-builders">
    <header className={styles.builderHeading}><h2 id="top-builders">Top builders</h2><p>Explore developers and their published properties.</p></header>
    {builders ? <HomeRail className={styles.builderRail} label="top builders" headerControls>
      {builders.map(builder => {
        const cover=imageSource(builder.cover), logo=imageSource(builder.logo);
        return <Link key={builder.id} className={styles.builderCard} href={`/${locale}/advertisers/${encodeURIComponent(builder.id)}#advertiser-properties`}>
          <div className={styles.builderCover}><Image src={cover || "/images/daylight/banners/projects.webp"} fill sizes="(max-width:600px) 80vw, 340px" alt="" unoptimized={Boolean(cover)}/>
            {builder.featured && <span data-shine="true">Featured · Premium</span>}</div>
          <div className={styles.builderIdentity}><BuilderLogo src={logo} name={builder.name}/>
            <div><h3>{builder.name} {builder.verified && <BadgeCheck className="market-verified" size={17} aria-label="Verified profile"/>}</h3>
            <small>{builder.established ? "Est. "+builder.established : builder.location}</small></div></div>
          <div className={styles.builderStats}><strong>{builder.count} published {builder.count===1?"property":"properties"}</strong>
            <small>{builder.projects>0 && <>{builder.projects} listed {builder.projects===1?"project":"projects"} · </>}{builder.cities} {builder.cities===1?"city":"cities"}</small></div>
          <span className={styles.builderAction}>View properties <ArrowRight size={17}/></span>
        </Link>;
      })}
    </HomeRail> : <SkeletonStatus label="Loading top builders"><Skeleton /></SkeletonStatus>}
  </section>;
}

export function FeaturedDealers({locale, extra=[], loading=false}: {
  locale:string; extra?:{id:string;verified?:boolean;fullName:string;profileLogoUrl:string|null;profileLocation:string|null;path:string|null}[]; loading?:boolean;
}) {
  const t=useTranslations("HomeDiscovery");
  const dealers=useHomeFeed<Listing[]>("/public/dealers?featured=1&limit=12");
  const entries=dealers ?? [];
  const month=new Intl.DateTimeFormat(locale,{month:"short",year:"numeric",timeZone:"UTC"});
  const cards:FeaturedCard[]=entries.map(({id,data,title})=>{
    const slug=String(data.slug || id);
    const href=`/${locale}/dealer/${encodeURIComponent(slug)}`;
    const name=String(data.dealerName || title);
    return {name,href,verified:Boolean(data.businessProfile),logo:imageSource(data.logoUrl),cover:imageSource(data.coverUrl),
      location:typeof data.city==="string"?data.city:undefined,
      specialty:typeof data.agencyName==="string" && data.agencyName!==name ? data.agencyName : undefined,
      membership:typeof data.memberSince==="string"?t("memberSince",{date:month.format(new Date(data.memberSince))}):undefined,
      activity:Number(data.weeklyEnquiries)>0?t("weeklyEnquiries",{count:Number(data.weeklyEnquiries)}):undefined,
      detail:t("propertyCount",{count:Number(data.propertyCount)||0}),contactHref:href+"#property-actions",
      listingsHref:`/${locale}/properties?${new URLSearchParams({dealer:slug})}`};
  });
  for(const person of extra){
    if(entries.some(({id,data})=>id===person.id || data.profileId===person.id || person.path==="dealer/"+(data.slug||id)))continue;
    cards.push({name:person.fullName,verified:person.verified,logo:imageSource(person.profileLogoUrl),location:person.profileLocation??undefined,
      href:person.path?`/${locale}/${person.path}`:undefined});
  }
  return <FeaturedProfileSection group="dealers" locale={locale} cards={cards} loading={loading||dealers===undefined} failed={dealers===null}/>;
}

export function BrowseByBudget({locale}: {locale: string}) {
  const heading = useId();
  const t = useTranslations("HomeDiscovery");
  const {midStarts, luxuryAbove} = propertyBudgetBoundaries;
  const price = new Intl.NumberFormat(locale === "en" ? "en-IN" : locale, {style: "currency", currency: "INR", maximumFractionDigits: 0});
  const ranges = [`< ${price.format(midStarts)}`, `${price.format(midStarts)} – ${price.format(luxuryAbove)}`, `> ${price.format(luxuryAbove)}`];
  return <section className={`market-width market-architecture-backdrop ${styles.section}`} aria-labelledby={heading}>
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
  return <section className={`market-width market-architecture-backdrop ${styles.section} ${styles.editorial}`} aria-labelledby={heading}>
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
