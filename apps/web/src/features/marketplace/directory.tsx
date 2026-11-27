"use client";

import {MaterialInput, MaterialSelect} from "@/components/ui/material-fields";
import Card from "@mui/material/Card";
import MuiButton from "@mui/material/Button";

import {ArrowUpRight, BadgeCheck, Bath, BedDouble, Building2, Car, ChevronLeft, ChevronRight, CookingPot, Eye, FilterX, Grid2X2, List, Images, BriefcaseBusiness, House, Map, MapPin, Maximize, Phone, Play, Search, Sofa, Sparkles, Zap} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useTranslations} from "next-intl";
import {MarketplaceBreadcrumbs} from "@/components/layout/marketplace-breadcrumbs";
import {useEffect, useMemo, useRef, useState} from "react";
import {PropertyArticles, propertyArticlesPath} from "@/features/articles/article-cards";
import type {ArticleCardData} from "@/features/articles/types";
import {isUploadedVideoUrl, materialCategories, materialOptionValue, materialUnits, propertyGalleryUrls} from "@the-property-pillar/contracts";
import {Button} from "@/components/ui/button";
import {Skeleton, SkeletonStatus} from "@/components/ui/loading-skeleton";
import {apiRequest} from "@/lib/api/client";
import {imageSource, safeHttpUrl} from "@/lib/image-source";
import {useSiteLocation} from "@/features/location/site-location";
import {multiPropertyFilters, propertySearchKeys} from "@/features/home/property-search-params";
import {browserPropertyInterests, rememberPropertySearch} from "@/features/home/property-interests";
import {HomeRail} from "@/features/home/home-rail";
import {useMarketplaceAuth} from "@/features/auth/marketplace-session";
import {directories, type DirectoryKey} from "@/config/marketplace";
import {propertyEnquiryHref, publicTaskHref} from "@/config/public-tasks";
import {propertyAmenityFields} from "@/config/property-amenities";
import {countryName, currencyForCountry, listingCurrencies} from "@/config/listing-geography";
import {ListingActions} from "./listing-actions";
import {PropertyGallery} from "./property-gallery";
import {PropertyContact} from "./property-contact";
import {calculateLoanSchedule, defaultLoanTerms} from "./loan-schedule";
import {compactPropertyPrice, cost} from "./listing-price";
import {MapFrame,PropertyMap} from "./property-map";
import {PropertyComments} from "./property-comments";
import {PropertyExtras, PropertyHighlights} from "./property-extras";
import {PropertyAssets} from "./property-assets";
import {isGoogleMapsLink, propertySpecificationFields} from "@the-property-pillar/contracts";
import {PropertyNearby} from "./property-nearby";
import {PropertyReport} from "./property-report";
import {SavePropertyHeart} from "./property-shortlist";
import {AdvancedResultFilters} from "./result-filters";
import styles from "./directory.module.css";
import design from "./listing-results.module.css";
import ui from "./property-presentation.module.css";

export type Listing = {
  id: string;
  title: string;
  status: string;
  description?: string | null;
  featured?: boolean;
  data: Record<string, unknown>;
};
type PropertyPage = {items: Listing[]; related: Listing[]; total: number; page: number; pageSize: number};

function display(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function humanize(value: string) {
  return value.includes("_") || /^[A-Z][A-Z ]*$/.test(value)
    ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : value;
}

function listingImages(item: Listing) {
  const sources = [item.data.mediaUrls, item.data.portfolioUrls].flatMap(urls => Array.isArray(urls) ? urls : []);
  sources.push(item.data.coverUrl, item.data.logoUrl);
  return [...new Set(sources.map(imageSource).filter(Boolean))];
}

function listingGallery(item: Listing) {
  return propertyGalleryUrls(item.data).map((url) => isUploadedVideoUrl(url) ? url : imageSource(url)).filter(Boolean);
}

function listingLocation(item: Listing, country: string) {
  if (Array.isArray(item.data.deliveryCities)) return item.data.deliveryCities.map(display).filter(Boolean).join(", ");
  return [...new Set([display(item.data.locality ?? item.data.localityName), display(item.data.city ?? item.data.cityName), country].filter(Boolean))].join(", ");
}

const listingFactHeadings = {
  properties: "Property facts", dealers: "Agency details", materials: "Product details", professionals: "Professional details",
  jobs: "Job at a glance", workers: "Worker details", projects: "Project details",
} satisfies Record<DirectoryKey, string>;

const areaLabels: Record<string, string> = {SQFT: "sq ft", SQM: "m²", ACRE: "acre", HECTARE: "ha"};

function materialLabel<T extends string>(options: readonly {value: T; label: string; aliases: readonly string[]}[], value: unknown) {
  const normalized = materialOptionValue(options, value);
  return options.find((option) => option.value === normalized)?.label ?? humanize(display(value));
}

function listingFacts(item: Listing, kind: DirectoryKey, locale: string, country: string) {
  const data = item.data;
  const number = new Intl.NumberFormat(locale === "en" ? "en-IN" : locale, {maximumFractionDigits: 3});
  const text = (key: string) => display(data[key]);
  const label = (key: string) => humanize(text(key));
  const count = (key: string) => typeof data[key] === "number" ? number.format(data[key]) : text(key);
  const size = [count("areaValue"), areaLabels[text("areaUnit")] ?? label("areaUnit")].filter(Boolean).join(" ");
  const availability = data.availabilityStatus ?? (item.status === "OUT_OF_STOCK" ? item.status : undefined);
  const materialUnitLabel = materialLabel(materialUnits, data.unit);
  const minimum = [count("minimumOrderQuantity"), materialUnitLabel].filter(Boolean).join(" · ");
  switch (kind) {
    case "properties": return [
      ...propertyAmenityFields.map(({key, label, options}): [string, string] => [label, options.find(({value}) => value === data[key])?.label ?? ""]),
      ["Bedrooms", count("bedrooms")], ["Washrooms", count("bathrooms")], ["Halls", count("halls")], ["Balconies", count("balconies")],
      ["Kitchen", text("kitchenType")], ["Project or society", text("projectOrSociety")], ["Property floor", count("floorNumber")], ["Total floors", count("totalFloors")], ["Facing", label("facing")],
      ["Listing type", data.listingIntent === "SALE" ? "For sale" : data.listingIntent === "RENT" ? "For rent" : data.listingIntent==="LEASE"?"For lease":""],
      ["Category", label("propertyCategory")], ["Property type", label("propertyType")], ["Property size", count("areaValue") ? size : ""],
      ["Construction status", humanize(text("constructionStatus"))], ["RERA registration", text("reraNumber")],
    ];
    case "materials": return [
      ["Category",text("categoryLabel") || materialLabel(materialCategories, data.category)],["Subcategory",text("subcategoryLabel")],["Pricing",label("pricingType")],["Product reference",text("reference")],["Pickup",data.pickupAvailable===true?"Available":""],["Delivery notes",text("deliveryNotes")], ["Brand", text("brand")], ["Grade or variant", text("variant")],
      ["Selling unit", materialUnitLabel], ["Minimum order", count("minimumOrderQuantity") ? minimum : ""],
      ["Availability", humanize(display(availability))], ["Tax on listed price", cost(item, locale) && typeof data.priceIncludesTax === "boolean" ? (data.priceIncludesTax ? "Included" : "Added separately") : ""],
    ];
    case "dealers": return [["Agency", text("agencyName")], ["RERA registration", text("reraNumber")]];
    case "professionals": return [["Service category", label("serviceType")], ["Years of experience", count("yearsExperience")], ["RERA registration", text("reraNumber")]];
    case "workers": return [["Trade", label("trade") || label("primaryTrade")], ["Years of experience", count("yearsExperience")],
      ["Availability", typeof data.availableNow === "boolean" ? (data.availableNow ? "Available now" : "Currently unavailable") : ""]];
    case "projects": return [["Project name", text("projectName")], ["Project type", label("projectType")], ["RERA registration", text("reraNumber")]];
    case "jobs": return jobSummary(item, locale, country);
  }
}

function jobSummary(item: Listing, locale: string, country: string) {
  const {salaryMin, salaryMax, currency, experienceYears, applicationDeadline, jobType, workMode, employmentType, state, employerName} = item.data;
  const salaryCurrency = /^[A-Z]{3}$/.test(display(currency)) ? display(currency) : "INR";
  const formatAmount = (amount: unknown) => typeof amount === "number"
    ? new Intl.NumberFormat(locale === "en" && salaryCurrency === "INR" ? "en-IN" : locale, {style: "currency", currency: salaryCurrency, maximumFractionDigits: 0}).format(amount)
    : "";
  const salary = [...new Set([formatAmount(salaryMin), formatAmount(salaryMax)].filter(Boolean))].join(" – ");
  const deadline = display(applicationDeadline);
  return [
    ["Employer", display(employerName)], ["Position", display(jobType)],
    ["Employment type", humanize(display(employmentType))], ["Work mode", workMode === "ON_SITE" ? "On-site" : humanize(display(workMode))],
    ["Location", [...new Set([display(item.data.locality), display(item.data.city), display(state), country].filter(Boolean))].join(", ")],
    ["Salary range", salary], ["Experience", typeof experienceYears === "number" ? (experienceYears === 0 ? "No prior experience required" : `${experienceYears} ${experienceYears === 1 ? "year" : "years"}`) : ""],
    ["Application deadline", /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? new Intl.DateTimeFormat(locale === "en" ? "en-IN" : locale, {dateStyle: "long", timeZone: "UTC"}).format(new Date(deadline)) : ""],
  ].filter(([, value]) => value);
}

const featuredLabels: Partial<Record<DirectoryKey, string>> = {
  dealers: "Featured Dealer", professionals: "Featured Professional", workers: "Featured Skilled Worker",
  materials: "Featured Material", jobs: "Featured Job",
};

function ListingBadges({item, kind}: {item: Listing; kind: DirectoryKey}) {
  const t = useTranslations("Site");
  const intent = display(item.data.listingIntent).toUpperCase();
  const propertyType = display(item.data.propertyType);
  return (
    <>
      {kind === "properties" && intent === "SALE" && <span className={`${styles.badge} ${styles.saleBadge}`}>{t("forSale")}</span>}
      {kind==="properties"&&intent==="LEASE"&&<span className={`${styles.badge} ${styles.rentBadge}`}>For lease</span>}
      {kind === "properties" && intent === "RENT" && <span className={`${styles.badge} ${styles.rentBadge}`}>{t("forRent")}</span>}
      {kind === "properties" && propertyType && <span className={`${styles.badge} ${styles.typeBadge}`}>{humanize(propertyType)}</span>}
      {kind === "properties" && item.featured && <span className={`${styles.badge} ${styles.featuredBadge}`}><Sparkles size={14} aria-hidden="true" />{t("featuredProperty")}</span>}
      {kind === "dealers" && item.data.pro === true && <span className={styles.badge}><BadgeCheck size={14} aria-hidden="true" />Pro</span>}
      {item.data.featured === true && featuredLabels[kind] && <span className={`${styles.badge} ${styles.featuredBadge}`}><Sparkles size={14} aria-hidden="true" />{featuredLabels[kind]}</span>}
      {kind === "materials" && (item.status === "OUT_OF_STOCK" || item.data.availabilityStatus === "OUT_OF_STOCK") && <span className={styles.badge}>Out of stock</span>}
      {kind === "workers" && (item.status === "AVAILABLE" || item.status === "BUSY") && <span className={styles.badge}>{humanize(item.status)}</span>}
    </>
  );
}

function PropertyPoster({poster, locale, compact = false, contact = false, masked}: {masked?:string; poster: unknown; locale: string; compact?: boolean; contact?: boolean}) {
  const t = useTranslations("Site");
  const [failedLogo, setFailedLogo] = useState("");
  if (!poster || typeof poster !== "object" || !("name" in poster) || typeof poster.name !== "string" || !poster.name.trim()) return null;
  const role = "role" in poster ? poster.role : undefined;
  const agency = "agencyName" in poster ? display(poster.agencyName) : "";
  const dealer = "dealer" in poster ? display(poster.dealer) : "";
  const project = "project" in poster ? display(poster.project) : "";
  const logo = "logoUrl" in poster ? imageSource(poster.logoUrl) : "";
  const label = role === "OWNER" ? t("propertyPosterOwner")
    : role === "DEALER" ? t("propertyPosterDealer") : role === "BUILDER" ? t("propertyPosterBuilder") : "";
  const person = poster.name.trim();
  const name = contact ? person : agency || person;
  const byline = contact ? agency : person;
  const initials = name.split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join("").toLocaleUpperCase(locale);
  const roleLabel = label || t("listedBy");
  const profileHref = dealer ? `/${locale}/dealer/${encodeURIComponent(dealer)}` : project ? `/${locale}/projects/${encodeURIComponent(project)}` : "";
  return <div className={`${styles.propertyPoster}${compact ? ` ${styles.compactPoster}` : ""}`}>
    <span className={styles.posterIcon} aria-hidden="true">{logo && logo !== failedLogo
      ? <Image src={logo} alt="" width={40} height={40} unoptimized onError={() => setFailedLogo(logo)} /> : initials}</span>
    <div><strong>{compact && profileHref ? <Link href={profileHref}>{name}</Link> : name}</strong>
      {masked ? <small dir="ltr">{masked}</small> : roleLabel.toLocaleLowerCase(locale) !== name.toLocaleLowerCase(locale) && <small>{roleLabel}</small>}
      {"featured" in poster && poster.featured === true && <small>Featured profile</small>}
      {!compact && <>
        {byline && byline !== name && <small>{byline}</small>}
        {profileHref && <Link className={styles.detailLink} href={profileHref}>{dealer ? "View dealer profile" : "View Builder project"}</Link>}
      </>}
    </div>
  </div>;
}

function ListingPhoto({source, alt, detail, kind}: {source: string; alt: string; detail?: boolean; kind: DirectoryKey}) {
  const [failed, setFailed] = useState(false);
  const Icon = directories[kind].icon;
  return (
    <div className={detail ? styles.detailPhoto : styles.photo}>
      {failed ? <div className={styles.photoFallback} aria-hidden="true"><Icon size={32} /></div> : (
        <Image src={source} alt={alt} fill unoptimized onError={() => setFailed(true)}
          sizes={detail ? "(max-width: 760px) 100vw, 1200px" : "(max-width: 540px) 100vw, (max-width: 1000px) 50vw, 33vw"} />
      )}
    </div>
  );
}

function posterRole(poster: unknown) {
  return poster && typeof poster === "object" && "role" in poster && (poster.role === "BUILDER" || poster.role === "DEALER") ? poster.role : "OWNER";
}

type DraftCardMedia = {url: string; video: boolean}[];

export function CompactPropertyCard({item, locale, draftMedia}: {item: Listing; locale: string; draftMedia?: DraftCardMedia}) {
  const t = useTranslations("Site");
  const {countryOptions} = useSiteLocation();
  const source = draftMedia ? draftMedia.find(file => !file.video)?.url : listingGallery(item).find(url => !isUploadedVideoUrl(url));
  const href = draftMedia ? "#" : `/${locale}/properties/${encodeURIComponent(item.id)}`;
  const place = listingLocation(item, countryName(item.data.countryCode, countryOptions));
  const price = compactPropertyPrice(item, locale);
  const rent = item.data.listingIntent === "RENT";
  const facts = [
    {Icon: BedDouble, value: display(item.data.bedrooms), label: t("bedrooms")},
    {Icon: Bath, value: display(item.data.bathrooms), label: t("bathrooms")},
    {Icon: Maximize, value: display(item.data.areaValue), label: display(item.data.areaUnit).toLocaleLowerCase(locale)},
    ...(item.data.propertyCategory==="COMMERCIAL"?[{Icon:Building2,value:display(item.data.workstations),label:"workstations"}]:[]),
    ...(item.data.propertyCategory==="PLOT_LAND"?[{Icon:Map,value:display(item.data.openSides),label:"open sides"}]:[]),
  ].filter(fact => fact.value);
  return <Card component="article" variant="outlined" className={ui.homeCard}>
    <div className={ui.cover}>
      <Link href={href} aria-label={item.title}>{source ? <ListingPhoto key={source} source={source} alt={item.title} kind="properties"/> : <House aria-hidden="true"/>}</Link>
      <div className={ui.coverActions}>
        {item.featured&&<span className={styles.featuredBadge}>{t("featuredProperty")}</span>}
        {Boolean(item.data.listingIntent) && <span className={ui.intent} data-rent={rent}>{item.data.listingIntent==="LEASE"?"For lease":t(rent ? "forRent" : "forSale")}</span>}
        <div>{item.data.hasMap === true && <Link href={href + "#property-map"} aria-label={"Map for " + item.title}><Map size={16}/></Link>}
          {!draftMedia && <SavePropertyHeart id={item.id} title={item.title}/>}</div>
      </div>
    </div>
    {price && <strong className={ui.price}><bdi>{price}</bdi></strong>}
    <div className={ui.description}><h3><Link href={href}>{item.title}</Link></h3>
      {place && <p title={place}>{place}</p>}
      {facts.length > 0 && <ul>{facts.map(({Icon,value,label}) => <li key={label}><Icon size={13}/>{value} {label}</li>)}</ul>}
    </div>
    <footer className={ui.seller}><PropertyPoster poster={item.data.postedBy} locale={locale} compact masked={display(item.data.contactPhoneMasked)}/>
      <Link className={ui.call} href={draftMedia ? href : propertyEnquiryHref(locale, item.id)} aria-label={"Contact listing agent for " + item.title}><Phone size={16}/></Link>
    </footer>
  </Card>;
}

function PropertyViewCount({count, locale, live = false}: {count: unknown; locale: string; live?: boolean}) {
  const t = useTranslations("Articles");
  if (typeof count !== "number") return null;
  return <span className={styles.propertyViews} aria-live={live ? "polite" : undefined}>
    <Eye size={15} aria-hidden="true" /><span>{t("views")} <bdi>{new Intl.NumberFormat(locale).format(count)}</bdi></span>
  </span>;
}

const propertyFactIcons = {Furnishing: Sofa, Parking: Car, "Power backup": Zap, Bedrooms: BedDouble,
  Washrooms: Bath, Halls: House, Balconies: Building2, Kitchen: CookingPot, "Property size": Maximize};
type PropertyTab = "overview" | "poster" | "recommendations" | "articles";

function usePropertyTabData<T>(path: string) {
  const [result, setResult] = useState<{path: string; items: T[]}>();
  useEffect(() => {
    const abort = new AbortController();
    void apiRequest<{items: T[]}>(path, {signal: abort.signal}).then(({items}) => {
      if (!abort.signal.aborted) setResult({path, items});
    }, () => {});
    return () => abort.abort();
  }, [path]);
  return result?.path === path ? result.items : [];
}

function PropertyDetail({item, locale}: {item: Listing; locale: string}) {
  const t = useTranslations("Articles");
  const site = useTranslations("Site");
  const contactText = useTranslations("PropertyContact");
  const {countryOptions} = useSiteLocation();
  const [selected, setSelected] = useState<PropertyTab>("overview");
  const [viewCount, setViewCount] = useState<number>();
  const tabsRef = useRef<Partial<Record<PropertyTab, HTMLButtonElement | null>>>({});
  const tabId = "property-" + item.id;
  const role = posterRole(item.data.postedBy);
  const recommendations = usePropertyTabData<Listing>("/public/properties/search?" + new URLSearchParams({relatedTo: item.id, limit: "6"}));
  const articles = usePropertyTabData<ArticleCardData>(propertyArticlesPath(locale, item.data));
  const tabs: {id: PropertyTab; label: string}[] = [
    {id: "overview", label: t("overview")},
    {id: "poster", label: t(role === "DEALER" ? "dealerDetails" : role === "BUILDER" ? "builderDetails" : "ownerDetails")},
  ];
  if (recommendations.length) tabs.push({id: "recommendations", label: t("recommendations")});
  if (articles.length) tabs.push({id: "articles", label: t("title")});
  const activeTab = tabs.some(({id}) => id === selected) ? selected : "overview";
  const poster = item.data.postedBy;
  const dealerBio = role === "DEALER" && poster && typeof poster === "object" && "aboutMe" in poster && typeof poster.aboutMe === "string"
    ? poster.aboutMe.trim() : "";
  const currency = String(item.data.currency || "INR");
  const country = countryName(item.data.countryCode, countryOptions);
  const location = listingLocation(item, country);
  const media = listingGallery(item);
  const showGallery = activeTab === "overview" && media.length > 0;
  const formattedPrice = cost(item, locale);
  const specifications = Object.entries(propertySpecificationFields).filter(([key]) =>
    key !== "externalVideo" && key !== "addressVisibility" && item.data[key] != null && item.data[key] !== "");
  const facts = listingFacts(item, "properties", locale, country).filter(([, value]) => value);
  const value = typeof item.data.price === "number" ? item.data.price : 0;
  const area = Number(item.data.areaValue ?? item.data.area ?? 0);
  const unit = display(item.data.areaUnit);
  const squarePrice = value > 0 && area > 0 && unit && /^[A-Z]{3}$/.test(currency) ?
    new Intl.NumberFormat(locale === "en" && currency === "INR" ? "en-IN" : locale, {style: "currency", currency, maximumFractionDigits: 0}).format(value / area) : "";
  const listedAt = typeof item.data.postedAt === "string" ? new Date(item.data.postedAt) : null;
  const canEstimate = item.data.listingIntent === "SALE" && value >= 1_000 && value <= 1_000_000_000 && listingCurrencies.some(({value}) => value === currency);
  const monthlyEmi = useMemo(() => {
    if (!canEstimate) return "";
    const money = new Intl.NumberFormat(locale === "en" && currency === "INR" ? "en-IN" : locale, {style: "currency", currency});
    const minorUnit = 10 ** (money.resolvedOptions().maximumFractionDigits ?? 2);
    const {payment} = calculateLoanSchedule(value, defaultLoanTerms.annualInterestRate, defaultLoanTerms.tenureYears, minorUnit);
    return money.format(payment / minorUnit);
  }, [canEstimate, value, currency, locale]);
  const about = typeof item.data.aboutPropertyHtml === "string" ? item.data.aboutPropertyHtml : "";
  useEffect(() => {
    const abort = new AbortController();
    void apiRequest<{viewCount: number}>(`/public/properties/${encodeURIComponent(item.id)}/views`, {method: "POST", signal: abort.signal})
      .then(({viewCount}) => {if (!abort.signal.aborted) setViewCount(viewCount);}, () => {});
    return () => abort.abort();
  }, [item.id]);

  useEffect(() => {
    const target = window.location.hash.slice(1);
    if (target === "property-map" || target === "property-actions") document.getElementById(target)?.scrollIntoView({block:"start"});
  }, [item.id]);

  function focusTab(index: number) {
    const tab = tabs[index];
    if (!tab) return;
    setSelected(tab.id);
    tabsRef.current[tab.id]?.focus();
  }

  const structured={"@context":"https://schema.org","@type":"RealEstateListing",name:item.title,description:item.description||undefined,datePosted:item.data.postedAt||undefined,image:media.filter(u=>!isUploadedVideoUrl(u)),contentLocation:{"@type":"Place",address:{"@type":"PostalAddress",addressLocality:item.data.city,addressRegion:item.data.state,addressCountry:item.data.countryCode}},...(value>0&&item.data.priceMode!=="ON_REQUEST"?{offers:{"@type":"Offer",price:value,priceCurrency:currency}}:{})};
  return <article className={`${styles.detail} ${styles.propertyDetail}`}><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structured).replace(/</g,"\\u003c")}}/>
    <div className={ui.detailGrid}>
      <div className={ui.detailMain}>
        {showGallery && <div className={styles.propertyMedia}><PropertyGallery sources={media} title={item.title} metadata={Array.isArray(item.data.galleryDetails)?item.data.galleryDetails:[]} /></div>}
    <header className={styles.propertySummary} data-motion="enter">
      <div className={styles.summaryBody}>
        <div className={styles.badges}><ListingBadges item={item} kind="properties" /></div>
        <h1>{item.title}</h1>
        {location && <p className={styles.location}><MapPin size={16} aria-hidden="true" />{location}</p>}
        <div className={styles.summaryMeta}>
          {display(item.data.reraNumber) && <span>RERA · {display(item.data.reraNumber)}</span>}
          {listedAt && Number.isFinite(listedAt.getTime()) && <time dateTime={listedAt.toISOString()}>{t("postedOn", {date: new Intl.DateTimeFormat(locale, {dateStyle: "medium", timeZone: "UTC"}).format(listedAt)})}</time>}
          <PropertyViewCount count={viewCount ?? item.data.viewCount} locale={locale} live />
        </div>
      </div>
      <div className={styles.summaryPrice}>
        {formattedPrice && <strong><bdi>{formattedPrice}</bdi></strong>}
        <div className={styles.summaryActions}>
          <div className={styles.priceNotes}>
            {squarePrice && <span><bdi>{squarePrice}</bdi> / {unit.toLowerCase()}</span>}
            {canEstimate && <Link title={site("loanCalculator") + " (20 years, 8.5%)"} className={styles.detailLink} href={`/${locale}/finance-services?${new URLSearchParams({amount: String(value), currency})}#emi-calculator`}>~EMI: {monthlyEmi}/mo</Link>}
          </div>
          <SavePropertyHeart id={item.id} title={item.title} label={t("shortlist")} className={styles.summarySave} />
        </div>
        <a className={`${styles.secondaryButton} ${styles.mobileContactLink}`} href="#property-actions">
          {t(role === "DEALER" ? "contactDealer" : role === "BUILDER" ? "contactBuilder" : "contactOwner")}
        </a>
      </div>
    </header>
    <div className={styles.propertyTabs} role="tablist" aria-label={t("propertyDetails")}>
      {tabs.map(({id, label}, index) => <MuiButton key={id} ref={(node) => {tabsRef.current[id] = node;}} type="button" role="tab"
        id={tabId + "-tab-" + id} aria-selected={activeTab === id} aria-controls={tabId + "-panel-" + id}
        tabIndex={activeTab === id ? 0 : -1} onClick={() => setSelected(id)} onKeyDown={(event) => {
          const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
          const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 :
            event.key === "ArrowRight" ? (index + (rtl ? -1 : 1) + tabs.length) % tabs.length :
              event.key === "ArrowLeft" ? (index + (rtl ? 1 : -1) + tabs.length) % tabs.length : null;
          if (next !== null) {event.preventDefault(); focusTab(next);}
        }}>{label}</MuiButton>)}
    </div>
        {tabs.map(({id, label}) => <div key={id} hidden={activeTab !== id} className={styles.propertyTabBody} role="tabpanel"
          id={tabId + "-panel-" + id} aria-labelledby={tabId + "-tab-" + id} tabIndex={0}>
          {activeTab === id && (id === "overview" ? <>
            <PropertyHighlights values={item.data.highlights} />
            {facts.length > 0 && <section className={styles.surface}><h2>{listingFactHeadings.properties}</h2><dl className={`${styles.facts} ${styles.propertyFacts}`}>
              {facts.map(([name, value]) => {
                const Icon = propertyFactIcons[name as keyof typeof propertyFactIcons] ?? BadgeCheck;
                return <div key={name}><dt><Icon size={17} aria-hidden="true" />{name}</dt><dd>{value}</dd></div>;
              })}</dl></section>}
            {(about || item.description) && <section className={`${styles.surface} ${styles.propertyAbout}`}><h2>{t("aboutProperty")}</h2>
              {about ? <div className={styles.richAbout} dangerouslySetInnerHTML={{__html: about}} /> : <p className={styles.description}>{item.description}</p>}
            </section>}
            <PropertyExtras data={item.data} sectionClassName={styles.surface} />
            <PropertyAssets id={item.id} kind="plans"/><PropertyAssets id={item.id} kind="documents"/>
            {specifications.length > 0 && <section className={styles.surface}>
              <h3>Listing specifications</h3>
              <dl className={styles.facts}>{specifications.map(([key, [, label]]) => {
                const value = String(item.data[key]);
                if (key === "googleMapsUrl") return isGoogleMapsLink(value) ? <div key={key}><dt>{label}</dt><dd><a href={value} target="_blank" rel="noreferrer">Open in Google Maps</a></dd></div> : null;
                const unit = key === "openParkingArea" || key === "coveredParkingArea" ? (item.data.areaUnits as Record<string,string> | undefined)?.[key] || display(item.data.areaUnit) : "";
                return <div key={key}><dt>{label}</dt><dd>{/^[A-Z][A-Z_]+$/.test(value) ? humanize(value) : value}{unit && ` ${unit}`}</dd></div>;
              })}</dl>
            </section>}
            {Array.isArray(item.data.additionalCharges)&&item.data.additionalCharges.length>0&&<section className={styles.surface}><h3>Additional charges</h3><dl>{item.data.additionalCharges.map((c,i)=><div key={i}><dt>{c.name}</dt><dd>{c.currency} {c.amount} · {c.frequency} · {c.included?"Included in price":"Additional"}</dd></div>)}</dl></section>}
            {Array.isArray(item.data.videoTours)&&item.data.videoTours.length>0&&<section className={styles.surface}><h3>Video tours</h3>{item.data.videoTours.map((v,i)=><p key={i}><a href={v.url} rel="noreferrer" target="_blank">{v.thumbnail&&<Image src={v.thumbnail} unoptimized width={140} height={82} alt="" style={{objectFit:"cover"}}/>} {v.title}</a> · {v.kind} {v.caption}</p>)}</section>}
            {typeof item.data.externalVideo==="string"&&<section className={styles.surface}><h3>Video tour</h3><a href={item.data.externalVideo} rel="noreferrer" target="_blank">Watch property video</a></section>}
            {Array.isArray(item.data.localPlaces)&&item.data.localPlaces.length>0&&<section className={styles.surface}><h3>Nearby landmarks</h3>{item.data.localPlaces.map((p,i)=><p key={i}>{p.name} · {p.category} · {p.distance} {p.unit}</p>)}</section>}
            <PropertyNearby id={item.id} location={location} locale={locale} />
            <PropertyComments id={item.id} locale={locale} />
            <PropertyReport id={item.id} locale={locale} />
          </> : id === "poster" ? <section className={styles.surface}><h2>{label}</h2>
            {poster ? <PropertyPoster poster={poster} locale={locale} /> : <p>{t("posterUnavailable")}</p>}
            {dealerBio && <div className={styles.dealerBio}><h3>{t("aboutDealer")}</h3><p>{dealerBio}</p></div>}
          </section> : id === "recommendations" ? <RelatedPropertyDetails items={recommendations} locale={locale} /> : <PropertyArticles articles={articles} locale={locale} />)}
        </div>)}
      </div>
      <aside className={ui.contactColumn} id="property-actions" aria-labelledby={tabId + "-contact-heading"}>
        <div className={`${styles.surface} ${styles.propertyContactAside}`}>
        <h2 id={tabId + "-contact-heading"}>{contactText("heading")}</h2>
        {poster ? <PropertyPoster poster={poster} locale={locale} contact /> : <p className={styles.description}>{t("posterUnavailable")}</p>}
        <PropertyContact id={item.id} locale={locale} masked={display(item.data.contactPhoneMasked)} inline />
        </div>
        {item.data.hasMap === true && <div id="property-map" className={ui.map}><PropertyMap id={item.id} /></div>}
      </aside>
    </div>
  </article>;
}

function ListingDetails({item, kind, locale}: {item: Listing; kind: DirectoryKey; locale: string}) {
  const contact = useRef<HTMLElement>(null);
  useEffect(() => {
    if (kind === "dealers" && window.location.hash === "#property-actions") contact.current?.scrollIntoView({block: "start"});
  }, [kind]);
  const images = listingImages(item);
  const [image, ...gallery] = images;
  const {countryOptions} = useSiteLocation();
  const country = countryName(item.data.countryCode, countryOptions);
  const location = listingLocation(item, country);
  const price = cost(item, locale);
  const facts = listingFacts(item, kind, locale, country).filter(([, value]) => value);
  const business=item.data.businessProfile as {name:string|null;about:string|null;logo:string|null;website:string|null;yearsExperience:number|null;categories:string[];specializations:string[]}|undefined;
  const job = kind === "jobs";
  const mediaLabel = kind === "professionals" ? "Portfolio photos" : "More photos";
  const specification = kind === "materials" ? display(item.data.specification) : "";
  const brochure = kind === "projects" ? safeHttpUrl(item.data.brochureUrl) : "";
  const video = isUploadedVideoUrl(item.data.videoUrl) ? item.data.videoUrl : "";
  const locations = [["Area", display(item.data.locality ?? item.data.localityName)], ["City", display(item.data.city ?? item.data.cityName)],
    ["State or region", display(item.data.state)], ["Country or territory", country]].filter(([, value]) => value);
  const lists = job ? [["responsibilities", "Responsibilities"], ["qualifications", "Qualifications"], ["skills", "Skills"], ["benefits", "Benefits"]]
    : [["deliveryCities", "Delivery cities"], ["citiesServed", "Cities served"], ["serviceAreas", "Service areas"]];
  const socialLinks = kind === "dealers" && item.data.socialLinks && typeof item.data.socialLinks === "object" ? item.data.socialLinks as Record<string, unknown> : {};
  const dealerLinks = [["instagramUrl", "Instagram"], ["facebookUrl", "Facebook"], ["youtubeUrl", "YouTube"], ["linkedinUrl", "LinkedIn"], ["whatsappChannelUrl", "WhatsApp channel"]]
    .map(([key, label]) => ({label, url: safeHttpUrl(socialLinks[key])})).filter(({url}) => url);
  const priceQualifier = kind === "workers" ? " / day" : kind === "materials" && item.data.unit ? " / " + materialLabel(materialUnits, item.data.unit) : "";
  return (
    <article className={styles.detail}>
      <div className={image ? styles.detailHero : undefined}>
        <header className={styles.detailHeading} data-motion="enter">
          <div className={styles.badges}><ListingBadges item={item} kind={kind} /></div>
          <h1>{item.title}</h1>
          {job && display(item.data.employerName) && <p className={styles.jobEmployer}>{display(item.data.employerName)}</p>}
          {location && kind !== "materials" && <p className={styles.location}><MapPin size={16} aria-hidden="true" />{location}</p>}
        </header>
        {image && <ListingPhoto key={image} source={image} alt={item.title} kind={kind} detail />}
      </div>
      <div className={styles.detailLayout}>
        <div className={styles.detailBody}>
          {facts.length > 0 && <section className={styles.surface}><h2>{listingFactHeadings[kind]}</h2><dl className={styles.facts}>
            {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl></section>}
          {item.description && <section className={styles.surface}><h2>Overview</h2>
            <p className={styles.description}>{item.description}</p>
          </section>}
          {business && <section className={styles.surface}><h2>{business.name || "Verified profile"}</h2>
            {business.logo && <Image src={business.logo} width={72} height={72} alt="Business logo" unoptimized/>}
            {business.about && <p>{business.about}</p>}{business.yearsExperience!=null && <p>{business.yearsExperience} years of experience</p>}{safeHttpUrl(business.website) && <a href={safeHttpUrl(business.website)} rel="noreferrer" target="_blank">Visit website</a>}<ul className={styles.detailTags}>{[...new Set([...business.categories,...business.specializations])].map(tag=><li key={tag}>{tag}</li>)}</ul></section>}
          {kind==="materials" && Array.isArray(item.data.technicalSpecs) && item.data.technicalSpecs.length>0 && <section className={styles.surface}><h2>Product specifications</h2><dl className={styles.facts}>{(item.data.technicalSpecs as Array<{name:string,unit:string|null,value:unknown}>).map((s,i)=><div key={i}><dt>{s.name}</dt><dd>{Array.isArray(s.value)?s.value.join(", "):typeof s.value==="object"&&s.value?Object.values(s.value).join(" – "):typeof s.value==="boolean"?(s.value?"Yes":"No"):String(s.value)} {s.unit}</dd></div>)}</dl></section>}
          {specification && <section className={styles.surface}><h2>Technical specification</h2><p className={styles.description}>{specification}</p></section>}
          {video && <section className={styles.surface}><h2>Video</h2><video className={styles.listingVideo} src={video} controls playsInline preload="none" poster={image || undefined} /></section>}
          {lists.map(([key, label]) => {
            const value = item.data[key];
            const entries = Array.isArray(value) ? [...new Set(value.map(display).filter(Boolean))] : [];
            return entries.length ? <section className={styles.surface} key={key}><h2>{label}</h2>
              <ul className={job ? styles.jobList : styles.detailTags}>{entries.map((entry) => <li key={entry}>{entry}</li>)}</ul>
            </section> : null;
          })}
          {!job && locations.length > 0 && <section className={styles.surface}><h2>Location</h2><dl className={styles.facts}>
            {locations.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl></section>}
          {gallery.length > 0 && <section className={styles.surface}><h2>{mediaLabel}</h2><div className={styles.gallery}>
            {gallery.map((source, index) => <ListingPhoto key={source} source={source} alt={`${item.title}, photo ${index + 2}`} kind={kind} />)}
          </div></section>}
          {brochure && <section className={styles.surface}><h2>Project brochure</h2><a className={styles.detailLink} href={brochure} target="_blank" rel="noreferrer">Open brochure <ArrowUpRight size={16} aria-hidden="true" /></a></section>}
          {dealerLinks.length > 0 && <section className={styles.surface}><h2>Agency online</h2><ul className={styles.detailTags}>
            {dealerLinks.map(({label, url}) => <li key={label}><a className={styles.detailLink} href={url} target="_blank" rel="noreferrer">{label} <ArrowUpRight size={14} aria-hidden="true" /></a></li>)}
          </ul></section>}
        </div>
        <aside className={styles.surface} aria-label="Listing actions" id="property-actions" ref={contact}>
          <h2>{job ? "Apply for this role" : price ? <>{price}{priceQualifier && <small>{priceQualifier}</small>}</> : "Listing actions"}</h2>
          <ListingActions kind={kind} id={item.id} title={item.title} locale={locale} phone={display(item.data.phone)} whatsapp={display(item.data.whatsappPhone)}
            acceptingApplications={item.data.acceptingApplications !== false} />
        </aside>
      </div>
      {kind === "dealers" && <DealerProperties dealer={display(item.data.slug) || item.id} locale={locale} />}
    </article>
  );
}

export function ListingCard({item, kind, locale, row = false, draftMedia}: {item: Listing; kind: DirectoryKey; locale: string; row?: boolean; draftMedia?: DraftCardMedia}) {
  const t=useTranslations("Site");
  const property = kind === "properties";
  const images = draftMedia ? draftMedia.map(file => file.url) : property ? listingGallery(item) : listingImages(item);
  const isVideo = (url: string) => draftMedia ? draftMedia.some(file => file.url === url && file.video) : isUploadedVideoUrl(url);
  const preview = images.slice(0, property && row ? 3 : 4);
  const remaining = images.length - preview.length;
  const {countryOptions} = useSiteLocation();
  const location = listingLocation(item, countryName(item.data.countryCode, countryOptions));
  const price = cost(item, locale);
  const Icon = directories[kind].icon;
  const facts = property ? [
    {icon: BedDouble, value: display(item.data.bedrooms), label: "bedrooms"},
    {icon: Bath, value: display(item.data.bathrooms), label: "bathrooms"},
    {icon: Maximize, value: display(item.data.areaValue), label: areaLabels[display(item.data.areaUnit)] || display(item.data.areaUnit).replaceAll("_", " ").toLowerCase() || "area"},
  ].filter(({value}) => value) : [];
  const slug = kind === "dealers" ? display(item.data.slug) || item.id : item.id;
  const href = draftMedia ? "#" : `/${locale}/${kind === "dealers" ? "dealer" : kind}/${encodeURIComponent(slug)}`;
  const cardFacts = row && !property ? listingFacts(item, kind, locale, countryName(item.data.countryCode, countryOptions)) : [];
  const featuredFacts = kind === "jobs" ? ["Employer", "Employment type", "Work mode", "Salary range", "Experience"]
    : kind === "materials" ? ["Brand", "Grade or variant", "Selling unit", "Minimum order", "Availability", "Category"] : undefined;
  const highlights = (featuredFacts
    ? featuredFacts.flatMap(label => cardFacts.filter(([name]) => name === label))
    : cardFacts).filter(([,value]) => value).slice(0, 5);
  const details = <Link className={styles.detailLink} href={href} aria-label={`View details for ${item.title}`}>View details <ArrowUpRight size={17} aria-hidden="true" /></Link>;
  if (row && kind === "professionals") {
    const portfolio = images.filter(url => !isVideo(url));
    const experience = item.data.yearsExperience;
    const areas = Array.isArray(item.data.serviceAreas) ? item.data.serviceAreas.filter(v=>typeof v==="string").join(", ") : display(item.data.serviceAreas);
    return <article className={design.professional} data-directory={kind}>
      {portfolio[0] ? <Link href={href} className={design.portfolio} aria-label={item.title}><ListingPhoto source={portfolio[0]} kind={kind} alt=""/></Link> :
        <div className={design.initials} aria-hidden="true">{item.title.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase()}</div>}
      <div className={design.profBody}><div className={design.overline}>{humanize(display(item.data.serviceType))}</div>
        <h2><Link href={href}>{item.title}</Link></h2>{location && <p><MapPin size={15}/>{location}</p>}
        {item.description && <p className={design.bio}>{item.description}</p>}
        {typeof experience==="number" && <span><BriefcaseBusiness size={15}/>{experience} {experience===1?"year":"years"} of experience</span>}
        {areas && <small>Service areas · {areas}</small>}<ListingBadges item={item} kind={kind}/>
      </div><footer><Link href={href}>View profile <ArrowUpRight size={15}/></Link></footer></article>;
  }
  if (property && row) {
    const cover = images.find(url=>!isVideo(url)) ?? images[0];
    const photoCount=images.filter(url=>!isVideo(url)).length;
    const amenities=Array.isArray(item.data.amenities)?item.data.amenities.length:0;
    const project=display(item.data.projectOrSociety);
    const intentLabel=item.data.listingIntent==="SALE"?t("forSale"):item.data.listingIntent==="RENT"?t("forRent"):item.data.listingIntent==="LEASE"?"For lease":"";
    const featured=item.featured || item.data.featured===true;
    return <article data-directory="properties" className={design.propertyCard} data-featured={featured || undefined}>
      <div className={design.cover}><Link href={href} aria-label={item.title}>{cover ? isVideo(cover)?<Play/>:<ListingPhoto source={cover} kind={kind} alt=""/>:<House size={34}/>}</Link>
        {featured && <span className={design.feature}><Sparkles size={12}/>{t("featuredProperty")}</span>}
        {!draftMedia && <SavePropertyHeart id={item.id} title={item.title} className={design.heart}/>}
        {photoCount>0 && <span className={design.photoCount}><Images size={13}/>{photoCount} {photoCount===1?"photo":"photos"}</span>}
      </div><div className={design.body}><div className={design.titleLine}><div>{project && project!==item.title && <div className={design.overline}>{project}</div>}<h2><Link href={href}>{item.title}</Link></h2></div>
        {price && <strong>{item.data.priceMode==="RANGE"||item.data.priceMode==="ON_REQUEST"?price:compactPropertyPrice(item,locale)||price}</strong>}</div>
        {(location||intentLabel) && <p className={design.address}><MapPin size={15}/>{[location,intentLabel].filter(Boolean).join(" · ")}</p>}
        {(facts.length>0 || typeof item.data.viewCount==="number") && <div className={design.specs}>{facts.map(({icon:FactIcon,label,value})=><span key={label}><FactIcon size={15}/>{value} {label}</span>)}
          {typeof item.data.viewCount==="number" && <span><PropertyViewCount count={item.data.viewCount} locale={locale}/></span>}</div>}
        <div className={design.tags}>{Boolean(item.data.reraNumber) && <span><BadgeCheck size={13}/>RERA number available</span>}
        {item.data.constructionStatus ? <span>{humanize(display(item.data.constructionStatus))}</span> : null}{amenities>0 && <span>{amenities} amenities</span>}</div>
        <footer><PropertyPoster poster={item.data.postedBy} locale={locale} compact/><div>{details}{!draftMedia && <PropertyContact id={item.id} locale={locale} masked={display(item.data.contactPhoneMasked)} row/>}</div></footer>
      </div></article>;
  }
  return (
    <Card component="article" variant="outlined" data-directory={kind} className={`${styles.card} ${property ? styles.propertyCard : ""} ${row ? styles.rowCard : ""}`}>
      {preview.length > 0 && <div className={styles.cardPreview}><Link className={styles.cardMedia} href={href} aria-label={`${images.some(isUploadedVideoUrl) ? "Gallery for" : "Photos of"} ${item.title}`} data-photo-count={preview.length}>
        {preview.map((source) => isVideo(source)
          ? <div className={`${styles.photo} ${styles.cardVideo}`} key={source}><Play size={23} aria-hidden="true" /> Video</div>
          : <ListingPhoto key={source} source={source} alt="" kind={kind} />)}
        <div className={`${styles.badges} ${styles.mediaBadges} ${property ? styles.propertyMediaBadges : ""}`}><ListingBadges item={item} kind={kind} /></div>
        {remaining > 0 && <span className={styles.morePhotos} aria-hidden="true">+{remaining}</span>}
      </Link>{property && !draftMedia && <SavePropertyHeart id={item.id} title={item.title} className={styles.cardHeart} />}</div>}
      <div className={styles.cardBody}>
        {preview.length === 0 && <div className={styles.cardMeta}>
          <span className={styles.cardIcon}><Icon size={19} aria-hidden="true" /></span>
          <div className={styles.badges}><ListingBadges item={item} kind={kind} /></div>
          {property && !draftMedia && <SavePropertyHeart id={item.id} title={item.title} />}
        </div>}
        <div className={styles.cardTitleRow}>
          <h2><Link href={href}>{item.title}</Link></h2>
        </div>
        {location && <p className={styles.location}><MapPin size={15} aria-hidden="true" />{location}</p>}
        {row && highlights.length > 0 && <dl className={styles.listingHighlights}>{highlights.map(([label,value]) =>
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
        {item.description && <p className={`${styles.description} ${styles.cardDescription}`}>{item.description}</p>}
        {(facts.length > 0 || property && typeof item.data.viewCount === "number") && <ul className={styles.cardFacts}>
          {facts.map(({icon: FactIcon, value, label}) => <li key={label}><FactIcon size={15} aria-hidden="true" />{value} {label}</li>)}
          {property && typeof item.data.viewCount === "number" && <li><PropertyViewCount count={item.data.viewCount} locale={locale} /></li>}
        </ul>}
        {property && !row && <PropertyPoster poster={item.data.postedBy} locale={locale} compact />}
        <footer className={`${styles.cardFooter}${row ? ` ${styles.rowFooter}` : ""}`}>
            {price && <strong>{price}{kind === "workers" && <small> / day</small>}</strong>}
            {details}
        </footer>
      </div>
    </Card>
  );
}

function PropertyDiscoveryRail({title, items, locale}: {title: string; items: Listing[]; locale: string}) {
  const {countryOptions} = useSiteLocation();
  const rail = useRef<HTMLDivElement>(null);
  const [controls, setControls] = useState({previous: false, next: false});
  function measure() {
    const element = rail.current;
    if (element) {
      const offset = Math.abs(element.scrollLeft);
      setControls({previous: offset > 2, next: element.scrollWidth - element.clientWidth - offset > 2});
    }
  }
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [items.length]);
  function move(direction: number) {
    const element = rail.current;
    if (!element) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const inlineDirection = getComputedStyle(element).direction === "rtl" ? -1 : 1;
    element.scrollBy({left: direction * inlineDirection * element.clientWidth * 0.8, behavior: reduced ? "instant" : "smooth"});
  }
  if (!items.length) return null;
  return <section className={styles.discovery} aria-label={title}>
    <h2>{title}</h2>
    <div className={styles.discoveryViewport}>
      <div className={styles.discoveryRail} ref={rail} onScroll={measure}>
        {items.map((item) => {
          const href = `/${locale}/properties/${item.id}`;
          const image = listingGallery(item).find((url) => !isUploadedVideoUrl(url));
          const poster = item.data.postedBy as {name?: string; role?: string} | undefined;
          const author = poster?.name ? `${poster.name} (${humanize(posterRole(poster))})` : "";
          const postedAt = typeof item.data.postedAt === "string" ? Date.parse(item.data.postedAt) : NaN;
          const date = Number.isFinite(postedAt) ? new Intl.DateTimeFormat(locale, {dateStyle: "medium"}).format(postedAt) : "";
          const price = cost(item, locale);
          const rooms = typeof item.data.bedrooms === "number" && item.data.bedrooms > 0 ? `${item.data.bedrooms} BHK` : "";
          const location = listingLocation(item, countryName(item.data.countryCode, countryOptions));
          return <Card component="article" variant="outlined" className={styles.discoveryCard} key={item.id}>
            <div className={styles.discoveryImage}>
              <Link href={href} aria-label={item.title}>{image ? <ListingPhoto source={image} alt={item.title} kind="properties" />
                : <div className={styles.photoFallback}><directories.properties.icon size={28} /></div>}</Link>
              <div className={styles.discoveryHeart}><SavePropertyHeart id={item.id} title={item.title} /></div>
            </div>
            {(author || date) && <div className={styles.discoveryPoster}>{author && <span>{author}</span>}{date && <time>{date}</time>}</div>}
            <div className={styles.discoveryInfo}>
              {(price || rooms) && <strong>{[price, rooms].filter(Boolean).join(" · ")}</strong>}
              <h3><Link href={href}>{item.title}</Link></h3>
              {location && <p>{location}</p>}
              <PropertyViewCount count={item.data.viewCount} locale={locale} />
            </div>
            <Link className={styles.discoveryEnquiry} href={href + "?enquire=" + encodeURIComponent(item.id)}>Enquire now <ArrowUpRight size={15} aria-hidden="true" /></Link>
          </Card>;
        })}
      </div>
      {controls.previous && <MuiButton className={styles.discoveryPrevious} type="button" onClick={() => move(-1)} aria-label={`Previous ${title.toLowerCase()}`}><ChevronLeft size={19} /></MuiButton>}
      {controls.next && <MuiButton className={styles.discoveryNext} type="button" onClick={() => move(1)} aria-label={`Next ${title.toLowerCase()}`}><ChevronRight size={19} /></MuiButton>}
    </div>
  </section>;
}

function PropertyResultsDiscovery({page, locale}: {page: PropertyPage; locale: string}) {
  const [recommendations, setRecommendations] = useState<Listing[]>([]);
  const {items, related} = page;
  useEffect(() => {
    const abort = new AbortController();
    setRecommendations([]);
    void apiRequest<{items: Listing[]}>("/public/properties/recommendations", {method: "POST", signal: abort.signal, body: {
      interests: browserPropertyInterests(), exclude: [...items, ...related].map(({id}) => id),
    }}).then(({items}) => {if (!abort.signal.aborted) setRecommendations(items.slice(0, 12));}, () => {});
    return () => abort.abort();
  }, [items, related]);
  return <>
    <CompactRecommendations title="Recommended properties" items={recommendations} locale={locale} />
    <PropertyDiscoveryRail title="Similar properties" items={related} locale={locale} />
  </>;
}

function RelatedPropertyDetails({items, locale}: {items: Listing[]; locale: string}) {
  const t = useTranslations("Articles");
  return <CompactRecommendations title={t("recommendations")} items={items} locale={locale} />;
}

function CompactRecommendations({title, items, locale}: {title: string; items: Listing[]; locale: string}) {
  if (!items.length) return null;
  return <section className={styles.discovery} aria-label={title}>
    <h2>{title}</h2>
    <HomeRail label={title.toLowerCase()}>{items.map((item) => <CompactPropertyCard key={item.id} item={item} locale={locale} />)}</HomeRail>
  </section>;
}

function DealerProperties({dealer, locale}: {dealer: string; locale: string}) {
  const t = useTranslations("Site");
  const [items, setItems] = useState<Listing[] | "unavailable" | null>(null);
  const query = new URLSearchParams({dealer});
  useEffect(() => {
    const abort = new AbortController();
    const params = new URLSearchParams({dealer, limit: "6"});
    void apiRequest<Listing[]>(`/public/properties?${params}`, {signal: abort.signal})
      .then((result) => {if (!abort.signal.aborted) setItems(result);}, () => {if (!abort.signal.aborted) setItems("unavailable");});
    return () => abort.abort();
  }, [dealer]);
  return <section className={styles.related} aria-label={t("properties")} id="dealer-properties">
    <div className={`market-featured-heading ${styles.dealerPropertiesHeading}`}>
      <h2>{t("properties")}</h2>
      {Array.isArray(items) && items.length > 0 && <Link className={styles.secondaryButton} href={`/${locale}/properties?${query}`}>
        {t("viewProperties")} <ArrowUpRight size={16} aria-hidden="true" />
      </Link>}
    </div>
    {items === null ? <ListingGridSkeleton kind="properties" count={3} />
      : items === "unavailable" || items.length === 0 ? <p>{t(items === "unavailable" ? "resultsUnavailable" : "noPublished")}</p>
        : <div className={styles.grid}>{items.map((item) => <ListingCard key={item.id} item={item} kind="properties" locale={locale} />)}</div>}
  </section>;
}

export function ListingGridSkeleton({kind, count = 6, row = false}: {kind: DirectoryKey; count?: number; row?: boolean}) {
  const t = useTranslations("Site");
  const hasPhoto = kind !== "jobs" && kind !== "workers";
  return <SkeletonStatus label={t("loadingListings")} className={row ? styles.resultsList : styles.grid}>
    {Array.from({length: count}, (_, index) => <div className={`${styles.skeletonCard} ${row ? styles.rowCard : ""}`} key={index} aria-hidden="true">
      {hasPhoto && <Skeleton className={styles.skeletonPhoto} />}
      <div className={styles.skeletonBody}>
        <Skeleton className={styles.skeletonTag} />
        <Skeleton className={styles.skeletonTitle} />
        <Skeleton className={styles.skeletonShort} />
        <Skeleton />
        <Skeleton className={styles.skeletonShort} />
      </div>
    </div>)}
  </SkeletonStatus>;
}

function ListingDetailSkeleton({kind}: {kind: DirectoryKey}) {
  const t = useTranslations("Site");
  const hasSidePhoto = kind !== "properties" && kind !== "jobs" && kind !== "workers";
  return <SkeletonStatus label={t("loadingDetail")} className={styles.detail}>
    {kind === "properties" && <div className={styles.skeletonGallery} aria-hidden="true">
      <Skeleton /><Skeleton /><Skeleton />
    </div>}
    <div className={hasSidePhoto ? styles.detailHero : undefined} aria-hidden="true">
      <div className={styles.detailHeading}>
        <div className={styles.skeletonLines}>
          <Skeleton className={styles.skeletonTag} />
          <Skeleton className={styles.skeletonDetailTitle} />
          <Skeleton className={styles.skeletonShort} />
        </div>
      </div>
      {hasSidePhoto && <div className={styles.detailPhoto}><Skeleton className={styles.skeletonDetailPhoto} /></div>}
    </div>
    <div className={styles.detailLayout} aria-hidden="true">
      <div className={`${styles.surface} ${styles.skeletonLines}`}>
        <Skeleton className={styles.skeletonTitle} /><Skeleton /><Skeleton className={styles.skeletonShort} />
      </div>
      <div className={`${styles.surface} ${styles.skeletonLines}`}>
        <Skeleton className={styles.skeletonTitle} /><Skeleton />
      </div>
    </div>
  </SkeletonStatus>;
}

export function FeaturedProperties({locale}: {locale: string}) {
  return <HomeProperties locale={locale} featured />;
}

export function HomeProperties({locale, featured = false}: {locale: string; featured?: boolean}) {
  const t = useTranslations("Site");
  const {place} = useSiteLocation();
  const [feed, setFeed] = useState<{path: string; items: Listing[]}>();
  const params = new URLSearchParams({limit: featured ? "20" : "6"});
  if (featured) params.set("featured", "1");
  else for (const [key, value] of Object.entries({nearCity: place?.city, nearState: place?.state, nearArea: place?.area, nearCountry: place?.countryCode})) {
    if (value) params.set(key, value);
  }
  const requestPath = `/public/properties?${params}`;
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<Listing[]>(requestPath, {signal: controller.signal})
      .then((items) => { if (!controller.signal.aborted) setFeed({path: requestPath, items}); })
      .catch(() => { if (!controller.signal.aborted) setFeed(undefined); });
    return () => controller.abort();
  }, [requestPath]);

  if (feed?.path !== requestPath || !feed.items.length) return null;
  const headingId = featured ? "featured-properties" : "all-listings";

  return <section className={`market-width market-featured ${styles.featured}`} aria-labelledby={headingId}>
    <div className="market-featured-heading">
      <h2 id={headingId}>{t(featured ? "featuredProperties" : "allPropertyListings")}</h2>
      <Link className={styles.secondaryButton} href={`/${locale}/properties`}>{t("viewProperties")} <ArrowUpRight size={16} aria-hidden="true" /></Link>
    </div>
    <HomeRail label="properties" className={featured ? undefined : styles.homeListingRail}>
      {feed.items.map(item => <CompactPropertyCard key={item.id} item={item} locale={locale} />)}
    </HomeRail>
  </section>;
}

export function MarketplaceDirectory({kind, locale, initialCity, initialIntent, initialCountry = "", initialCategory = "", initialPropertyType = "", initialKeyword = "", propertyFilters = "", initialPage = 1, initialSort = "match", selected}: {
  kind: DirectoryKey; locale: string; initialCity: string; initialIntent: string; initialCountry?: string; initialCategory?: string; initialPropertyType?: string; initialKeyword?: string; selected?: string;
  propertyFilters?: string;
  initialPage?: number;
  initialSort?: string;
}) {
  const t = useTranslations("Site");

  const [records, setRecords] = useState<Listing[] | null>(null);
  const session = useMarketplaceAuth()?.session ?? null;
  const interestSession = useRef(session);
  interestSession.current = session;
  const router = useRouter();
  const [failure, setFailure] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [mapView,setMapView]=useState(false);
  const [gridView,setGridView]=useState(false);
  const [mapListing,setMapListing]=useState("");
  const [query, setQuery] = useState(initialKeyword);
  const [searchedKeyword, setSearchedKeyword] = useState(initialKeyword.trim());
  const [city, setCity] = useState(initialCity);
  const [searchedCity, setSearchedCity] = useState(initialCity.trim());
  const [intent, setIntent] = useState(initialIntent);
  const [country, setCountry] = useState(initialCountry);
  const [category, setCategory] = useState(() => kind === "materials" ? materialOptionValue(materialCategories, initialCategory) ?? "" : initialCategory);
  const [propertyType, setPropertyType] = useState(initialPropertyType);
  const [extraFilters, setExtraFilters] = useState(propertyFilters);
  const [page, setPage] = useState(initialPage);
  const [sort, setSort] = useState(initialSort);
  const [paging, setPaging] = useState<PropertyPage | null>(null);
  const propertyResults = !selected && kind === "properties";
  const {place, countryOptions} = useSiteLocation();
  const supportsCountry = kind === "properties" || kind === "jobs" || kind === "dealers" || kind === "materials";
  const applied = new URLSearchParams(extraFilters);
  const firstCountry = (applied.getAll("place").map((value) => (JSON.parse(value) as {country?: string}).country).find(Boolean));
  const sortCurrency = applied.get("currency") || currencyForCountry(country || firstCountry || place?.countryCode || "") || "INR";
  const useNearby = !searchedCity && (!country || country === place?.countryCode);
  const nearCity = searchedCity || (useNearby ? place?.city : "") || "";
  const nearArea = useNearby ? place?.area || "" : "";
  const nearState = useNearby ? place?.state || "" : "";
  const nearCountry = supportsCountry && useNearby ? place?.countryCode || "" : "";

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchedCity(city.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [city]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchedKeyword(query.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selected || url.pathname.replace(/\/$/, "") !== `/${locale}/${kind}`) return;
    const current = url.search;
    const apply = new URLSearchParams(extraFilters);
    for (const [key, value] of Object.entries({city: searchedCity, q: searchedKeyword, intent, country, category, type: propertyType,
      ...Object.fromEntries(propertySearchKeys.filter(key=>!multiPropertyFilters.includes(key)).map((key) => [key, apply.get(key) ?? ""])),
      page: propertyResults && page > 1 ? String(page) : "", sort: propertyResults && sort !== "match" ? sort : ""})) {
      if (!value) url.searchParams.delete(key);
      else if (url.searchParams.get(key) !== value) url.searchParams.set(key, value);
    }
    for (const key of ["place", ...multiPropertyFilters]) {
      const values=apply.getAll(key);
      if (JSON.stringify(url.searchParams.getAll(key))!==JSON.stringify(values)) {
        url.searchParams.delete(key);
        for (const value of values) url.searchParams.append(key,value);
      }
    }
    if (url.search !== current) window.history.replaceState(null, "", url);
  }, [kind, locale, selected, searchedCity, searchedKeyword, intent, country, category, propertyType, extraFilters, propertyResults, page, sort]);

  const params = new URLSearchParams();
  if (selected) {
    params.set("item", selected);
    params.set("limit", "1");
  } else {
    if (nearCity) params.set("nearCity", nearCity.slice(0, 120));
    if (searchedCity) params.set("location", searchedCity.slice(0, 120));
    if (searchedKeyword) params.set("q", searchedKeyword.slice(0, 120));
    if (nearArea) params.set("nearArea", nearArea);
    if (nearState) params.set("nearState", nearState);
    if (nearCountry) params.set("nearCountry", nearCountry);
    if (supportsCountry && country) params.set("country", country);
    if ((kind === "properties" || kind === "materials") && category) params.set("category", category);
    if (kind === "properties") {
      if (intent) params.set("intent", intent);
      if (propertyType) params.set("propertyType", propertyType);
    }
    for (const [key, value] of new URLSearchParams(extraFilters)) params.append(key, value);
    if (propertyResults) {
      params.set("page", String(page));
      params.set("sort", sort);
      if (sort.startsWith("price-") && !params.has("currency")) params.set("currency", sortCurrency);
    }
  }
  const requestPath = `/public/${kind}${propertyResults ? "/search" : ""}?${params.toString()}`;
  useEffect(() => {
    const controller = new AbortController();
    setRecords(null);
    setFailure("");
    apiRequest<Listing[] | PropertyPage>(requestPath, {signal: controller.signal})
      .then((results) => {
        if (!controller.signal.aborted) {
          setRecords(Array.isArray(results) ? results : results.items);
          setPaging(Array.isArray(results) ? null : results);
          setFailure("");
          if (!Array.isArray(results) && results.page === 1 && kind === "properties" && !selected) {
            rememberPropertySearch(new URLSearchParams(requestPath.split("?")[1]), results.items, interestSession.current);
          }
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setFailure(error instanceof Error ? error.message : "Unable to load results.");
      });
    return () => controller.abort();
  }, [requestPath, attempt, kind, selected]);

  const matches = useMemo(() => (records ?? []).filter((item) => !selected || selected === item.id || selected === item.data.slug), [records, selected]);

  const prefix = "/" + locale;
  const Icon = directories[kind].icon;
  const filtersApplied = Boolean(query.trim() || city.trim() || intent || country || category || propertyType || extraFilters);
  const saveSearchParams = new URLSearchParams();
  if (city.trim()) saveSearchParams.set("city", city.trim());
  if (intent) saveSearchParams.set("intent", intent);

  function clearFilters() {
    setQuery("");
    setCity("");
    setIntent("");
    setCountry("");
    setCategory("");
    setPropertyType("");
    setExtraFilters("");
    setPage(1);
    setSort("match");
  }
  const locationChips = new URLSearchParams(extraFilters).getAll("place");
  function setAdvanced(value: string) {setExtraFilters(value); setPage(1);}
  function removePropertyFilter(key:string,value:string) {
    const next=new URLSearchParams(extraFilters);
    next.delete(key,value);
    if(key==="landmark"){next.delete("landmarkKind");next.delete("landmarkFrom");}
    if(key==="currency"){next.delete("minPrice");next.delete("maxPrice");next.delete("budget");if(sort.startsWith("price-"))setSort("match");}
    if(key==="unit"){next.delete("minArea");next.delete("maxArea");}
    setAdvanced(next.toString());
  }
  function setQuick(key: string, value: string) {
    const next = new URLSearchParams(extraFilters);
    if (value) next.set(key, value); else next.delete(key);
    if (key === "currency" && value !== "INR") next.delete("budget");
    setAdvanced(next.toString());
  }
  function goToPage(nextPage: number) {
    const url = new URL(window.location.href);
    if (nextPage > 1) url.searchParams.set("page", String(nextPage)); else url.searchParams.delete("page");
    if (sort.startsWith("price-") && !url.searchParams.has("currency")) url.searchParams.set("currency", sortCurrency);
    router.push(url.pathname + url.search, {scroll: false});
    document.getElementById("property-results")?.scrollIntoView({block: "start"});
  }

  return (
    <>
      {propertyResults && <header className={design.heading}><div><h1>{applied.get("landmark") ? "Properties near "+applied.get("landmark") : [t(intent==="SALE"?"homesForSale":intent==="RENT"?"homesForRent":"properties"), city && "in "+city].filter(Boolean).join(" ")}</h1>
        <p>Find your next property by location, budget and lifestyle.</p></div>
        <button type="button" aria-pressed={mapView} onClick={()=>setMapView(!mapView)}><Map size={16}/>{mapView?"List view":"Map view"}</button></header>}
      {propertyResults && applied.has("landmark") && <div className={styles.resultChips}><MuiButton type="button" onClick={()=>{
        const next=new URLSearchParams(extraFilters);
        for(const key of ["landmark","landmarkKind","landmarkFrom"]) next.delete(key);
        setAdvanced(next.toString());
      }}>{applied.get("landmark")} ×</MuiButton><small>Nearby matches use the listing’s neighbourhood or its city centre when a pin is unavailable.</small></div>}
      {selected ? (
        <MarketplaceBreadcrumbs locale={locale} parent={{title: t(directories[kind].title), href: `${prefix}/${kind}`}}
          current={matches[0]?.title ?? t("listingDetails")} />
      ) : !propertyResults && (
        <div className={styles.filters} role="group" aria-label="Filter marketplace results">
          <label className={styles.filterField}>
            <span>{t("keyword")}</span>
            <span className={styles.inputWrap}><Search size={17} aria-hidden="true" />
              <MaterialInput type="search" placeholder={t("searchKeyword")} maxLength={120} value={query} onChange={(event) => {setQuery(event.target.value); setPage(1);}} />
            </span>
          </label>
          {supportsCountry && kind !== "dealers" && <label className={styles.filterField}>
            <span>{t("country")}</span>
            <span className={`${styles.inputWrap} ${styles.selectWrap}`}>
              <MaterialSelect aria-label={t("country")} value={country} onChange={(event) => {setCountry(event.target.value); setPage(1);}}>
                <option value="">{t("allCountries")}</option>
                {countryOptions.map(({label, value}) => <option key={value} value={value}>{label}</option>)}
              </MaterialSelect>
            </span>
          </label>}
          <label className={styles.filterField}>
            <span>{t(kind === "materials" ? "deliveryCity" : "location")}</span>
            <span className={styles.inputWrap}><MapPin size={17} aria-hidden="true" />
              <MaterialInput placeholder={t(kind === "materials" ? "deliveryCity" : "cityArea")} maxLength={120} value={city} onChange={(event) => {
                setCity(event.target.value);
                const next = new URLSearchParams(extraFilters);
                next.delete("locationKind");
                setAdvanced(next.toString());
              }} />
            </span>
          </label>
          {kind === "materials" && <label className={styles.filterField}>
            <span>{t("materialCategory")}</span>
            <span className={`${styles.inputWrap} ${styles.selectWrap}`}>
              <MaterialSelect aria-label={t("materialCategory")} value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">{t("allCategories")}</option>
                {materialCategories.map(({label, value}) => <option key={value} value={value}>{label}</option>)}
              </MaterialSelect>
            </span>
          </label>}
          {kind !== "materials" && (category || propertyType) && <span className={styles.activeFilter}>{humanize(propertyType || category)}</span>}
          {extraFilters && !propertyResults && <span className={styles.activeFilter}>{t("propertySearchFilters")}</span>}
          {filtersApplied && <MuiButton className={styles.clearButton} type="button" onClick={clearFilters}>
            <FilterX size={17} aria-hidden="true" />{t("clearFilters")}
          </MuiButton>}
        </div>
      )}
      {!propertyResults && !selected && locationChips.length > 0 && <div className={styles.resultChips} aria-label="Selected locations">{locationChips.map((entry) => {
        const {value} = JSON.parse(entry) as {value: string};
        return <MuiButton key={entry} type="button" onClick={() => {
          const next = new URLSearchParams(extraFilters); next.delete("place", entry); setAdvanced(next.toString());
        }} aria-label={"Remove " + value}>{value} ×</MuiButton>;
      })}</div>}
      {!propertyResults && !selected && records && (
        <div className="market-task-links">
          <p className={styles.resultCount} role="status">{t("results", {count: paging?.total ?? matches.length})}{!propertyResults && !city && place && (place.area || place.city || place.state) ? ` · ${t("nearbyFirst")}` : ""}</p>
          {kind === "properties" && <Link className="market-text-link" href={publicTaskHref(locale, "properties/save-search", saveSearchParams)}>{t("saveSearch")}</Link>}
        </div>
      )}
      {!propertyResults && !selected && !records && !failure && <div aria-hidden="true" className={`market-task-links ${styles.skeletonResultBar}`}>
        <Skeleton className={styles.skeletonTag} />
        {kind === "properties" && <Skeleton className={styles.skeletonSearchAction} />}
      </div>}
      <div className={!selected ? [styles.resultsLayout,propertyResults && design.layout].filter(Boolean).join(" ") : undefined}>
      {!selected && <aside aria-label="Refine listings"><AdvancedResultFilters kind={kind} value={extraFilters} onChange={setAdvanced}
        defaultCurrency={sortCurrency} clearAll={clearFilters}
        locationFilter={propertyResults ? <>
          <label>Keyword<MaterialInput type="search" maxLength={120} value={query} onChange={e=>setQuery(e.target.value)}/></label>
          <label>City or area<MaterialInput maxLength={120} value={city} onChange={e=>setCity(e.target.value)}/></label>
          <label>Country<MaterialSelect value={country} onChange={e=>{setCountry(e.target.value);setPage(1);}}><option value="">{t("allCountries")}</option>{countryOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</MaterialSelect></label>
          <label>Listing type<MaterialSelect value={intent} onChange={e=>{setIntent(e.target.value);setPage(1);}}><option value="">Any</option><option value="SALE">{t("buy")}</option><option value="RENT">{t("rent")}</option><option value="LEASE">Lease</option></MaterialSelect></label>
        </> : kind === "dealers" && <label>{t("country")}<MaterialSelect value={country} onChange={e => {setCountry(e.target.value);setPage(1);}}>
          <option value="">{t("allCountries")}</option>{countryOptions.map(({label,value}) => <option key={value} value={value}>{label}</option>)}
        </MaterialSelect></label>}/></aside>}
      <div className={styles.resultBody} id={propertyResults ? "property-results" : undefined}>
      {propertyResults && <><div className={design.toolbar}><strong role="status">{failure?"":records ? t("results",{count:paging?.total ?? matches.length}) : "Loading properties…"}</strong>
        <div><label>Sort by <select value={sort} onChange={e=>{setSort(e.target.value);setPage(1);if(e.target.value.startsWith("price-")&&!applied.has("currency"))setQuick("currency",sortCurrency);}}>
        <option value="match">Best match</option><option value="newest">Newest</option><option value="price-low">Lowest price</option><option value="price-high">Highest price</option><option value="area-low">Smallest area</option><option value="area-high">Largest area</option></select></label>
        <button type="button" aria-label="List view" aria-pressed={!gridView&&!mapView} onClick={()=>{setGridView(false);setMapView(false);}}><List size={17}/></button>
        <button type="button" aria-label="Grid view" aria-pressed={gridView&&!mapView} onClick={()=>{setGridView(true);setMapView(false);}}><Grid2X2 size={16}/></button></div></div>
        <div className={design.applied}>{[{value:query,clear:setQuery},{value:city,clear:setCity},{value:country,clear:setCountry},{value:intent,clear:setIntent},{value:category,clear:setCategory},{value:propertyType,clear:setPropertyType}].map(({value,clear},index)=>value && <button key={index} type="button" onClick={()=>{clear("");setPage(1);}}>{humanize(value)} ×</button>)}{[...applied].filter(([key])=>!["landmarkFrom","landmarkKind"].includes(key)).map(([key,value])=><button key={key+value} type="button" onClick={()=>removePropertyFilter(key,value)}>{key==="place" ? JSON.parse(value).value : key==="bedrooms" ? (value==="0"?"Studio":value+" BHK") : ["rera","featured","verifiedSeller"].includes(key)?({rera:"RERA number",featured:"Featured",verifiedSeller:"Verified seller"}[key]):["minPrice","maxPrice","floor","minArea","maxArea"].includes(key)?key.replace(/([A-Z])/g," $1")+" "+value:humanize(value)} ×</button>)}
        <Link href={publicTaskHref(locale,"properties/save-search",saveSearchParams)}>{t("saveSearch")}</Link></div></>}
      {failure ? (
        <div className={styles.state} role="alert">
          <span className={styles.stateIcon}><Icon size={24} aria-hidden="true" /></span>
          <h2>{t("resultsUnavailable")}</h2>
          <p>{failure}</p>
          <Button className={styles.primaryButton} onClick={() => {setFailure(""); setRecords(null); setAttempt((value) => value + 1);}}>{t("retry")}</Button>
        </div>
      ) : !records ? (
        selected ? <ListingDetailSkeleton kind={kind} /> : <ListingGridSkeleton kind={kind} row />
      ) : matches.length === 0 ? (
        <div className={styles.state}>
          <span className={styles.stateIcon}><Search size={25} aria-hidden="true" /></span>
          <h2>{t(selected ? "pageUnavailable" : filtersApplied ? "noResults" : "noPublished")}</h2>
          <p>{t(selected ? "listingUnavailable" : filtersApplied ? "broaderSearch" : "publicationNotice")}</p>
          {selected ? <Link className={styles.secondaryButton} href={prefix + "/" + kind}>{t("backToResults")}</Link>
            : filtersApplied ? <MuiButton type="button" className={styles.secondaryButton} onClick={clearFilters}>{t("clearFilters")}</MuiButton>
            : <Link className={styles.secondaryButton} href={prefix + "/dashboard"}>{t("openWorkspace")}<ArrowUpRight size={16} aria-hidden="true" /></Link>}
        </div>
      ) : selected ? (
        kind === "properties" ? <PropertyDetail key={matches[0].id} item={matches[0]} locale={locale} /> : <ListingDetails item={matches[0]} kind={kind} locale={locale} />
      ) : propertyResults&&mapView? (()=>{
        const pins=matches.filter(it=>it.data.searchPin);
        const choice=pins.find(it=>it.id===mapListing)??pins[0];
        return choice?<section className={styles.surface}><label>Property on map <MaterialSelect value={choice.id} onChange={e=>setMapListing(e.target.value)}>{pins.map(it=><option value={it.id} key={it.id}>{it.title}</option>)}</MaterialSelect></label><MapFrame pin={choice.data.searchPin as {latitude:number;longitude:number}}/><small>Approximate area</small> <Link href={prefix+"/properties/"+choice.id}>View property</Link></section>:<p>These listings share their locality only.</p>;
      })(): (
        <div className={[styles.resultsList,kind==="professionals" && design.profGrid,propertyResults && gridView && design.propGrid].filter(Boolean).join(" ")} data-motion="stagger">
          {matches.map((item) => <ListingCard key={item.id} item={item} kind={kind} locale={locale} row />)}
        </div>
      )}
      {propertyResults && paging && paging.total > paging.pageSize && <nav className={styles.pagination} aria-label="Property result pages">
        <MuiButton type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}>Previous</MuiButton>
        <span aria-current="page">Page {page} of {Math.ceil(paging.total / paging.pageSize)}</span>
        <MuiButton type="button" disabled={page * paging.pageSize >= paging.total} onClick={() => goToPage(page + 1)}>Next</MuiButton>
      </nav>}
      {propertyResults && records && !failure && paging && <PropertyResultsDiscovery page={paging} locale={locale} />}
      </div></div>
    </>
  );
}
