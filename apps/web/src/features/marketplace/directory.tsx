"use client";

import {ArrowLeft, ArrowUpRight, BadgeCheck, Bath, BedDouble, ChevronDown, FilterX, MapPin, Maximize, Search, Sparkles} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {useEffect, useMemo, useState} from "react";
import {materialCategories, materialOptionValue, materialUnits} from "@the-property-pillar/contracts";
import {Button} from "@/components/ui/button";
import {apiRequest} from "@/lib/api/client";
import {imageSource, safeHttpUrl} from "@/lib/image-source";
import {useSiteLocation} from "@/features/location/site-location";
import {directories, type DirectoryKey} from "@/config/marketplace";
import {publicTaskHref} from "@/config/public-tasks";
import {countryName, listingCountries} from "@/config/listing-geography";
import {ListingActions} from "./listing-actions";
import {PropertyGallery} from "./property-gallery";
import styles from "./directory.module.css";

type Listing = {
  id: string;
  title: string;
  status: string;
  description?: string | null;
  data: Record<string, unknown>;
};

function display(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function humanize(value: string) {
  return value.includes("_") || /^[A-Z][A-Z ]*$/.test(value)
    ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : value;
}

function cost(item: Listing) {
  const amount = item.data.price ?? item.data.priceAmount ?? item.data.indicativePrice ?? item.data.dailyRate ?? item.data.startingPrice;
  const currency = display(item.data.currency) || "INR";
  if (typeof amount !== "number" || amount < 0 || !/^[A-Z]{3}$/.test(currency)) return "";
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en", {style: "currency", currency}).format(amount);
}

function listingImages(item: Listing) {
  const media = item.data.mediaUrls ?? item.data.portfolioUrls;
  const sources = [...(Array.isArray(media) ? media : []), item.data.coverUrl, item.data.logoUrl];
  return [...new Set(sources.map(imageSource).filter(Boolean))];
}

function listingLocation(item: Listing) {
  if (Array.isArray(item.data.deliveryCities)) return item.data.deliveryCities.map(display).filter(Boolean).join(", ");
  return [...new Set([display(item.data.locality ?? item.data.localityName), display(item.data.city ?? item.data.cityName), countryName(item.data.countryCode)].filter(Boolean))].join(", ");
}

const listingFactHeadings = {
  properties: "Property facts", dealers: "Agency details", materials: "Product details", professionals: "Professional details",
  jobs: "Job at a glance", workers: "Worker details", projects: "Project details",
} satisfies Record<DirectoryKey, string>;

const areaLabels: Record<string, string> = {SQFT: "sq ft", SQM: "m²", ACRE: "acre", HECTARE: "ha"};
const number = new Intl.NumberFormat("en-IN", {maximumFractionDigits: 3});

function materialLabel<T extends string>(options: readonly {value: T; label: string; aliases: readonly string[]}[], value: unknown) {
  const normalized = materialOptionValue(options, value);
  return options.find((option) => option.value === normalized)?.label ?? humanize(display(value));
}

function listingFacts(item: Listing, kind: DirectoryKey) {
  const data = item.data;
  const text = (key: string) => display(data[key]);
  const label = (key: string) => humanize(text(key));
  const count = (key: string) => typeof data[key] === "number" ? number.format(data[key]) : text(key);
  const size = [count("areaValue"), areaLabels[text("areaUnit")] ?? label("areaUnit")].filter(Boolean).join(" ");
  const availability = data.availabilityStatus ?? (item.status === "OUT_OF_STOCK" ? item.status : undefined);
  const materialUnitLabel = materialLabel(materialUnits, data.unit);
  const minimum = [count("minimumOrderQuantity"), materialUnitLabel].filter(Boolean).join(" · ");
  switch (kind) {
    case "properties": return [
      ["Listing type", data.listingIntent === "SALE" ? "For sale" : data.listingIntent === "RENT" ? "For rent" : ""],
      ["Category", label("propertyCategory")], ["Property type", label("propertyType")], ["Property size", count("areaValue") ? size : ""],
      ["Bedrooms", count("bedrooms")], ["Bathrooms", count("bathrooms")], ["RERA registration", text("reraNumber")],
    ];
    case "materials": return [
      ["Category", materialLabel(materialCategories, data.category)], ["Brand", text("brand")], ["Grade or variant", text("variant")],
      ["Selling unit", materialUnitLabel], ["Minimum order", count("minimumOrderQuantity") ? minimum : ""],
      ["Availability", humanize(display(availability))], ["Tax on listed price", cost(item) && typeof data.priceIncludesTax === "boolean" ? (data.priceIncludesTax ? "Included" : "Added separately") : ""],
    ];
    case "dealers": return [["Agency", text("agencyName")], ["RERA registration", text("reraNumber")]];
    case "professionals": return [["Service category", label("serviceType")], ["Years of experience", count("yearsExperience")], ["RERA registration", text("reraNumber")]];
    case "workers": return [["Trade", label("trade") || label("primaryTrade")], ["Years of experience", count("yearsExperience")],
      ["Availability", typeof data.availableNow === "boolean" ? (data.availableNow ? "Available now" : "Currently unavailable") : ""]];
    case "projects": return [["Project name", text("projectName")], ["Project type", label("projectType")], ["RERA registration", text("reraNumber")]];
    case "jobs": return jobSummary(item);
  }
}

function jobSummary(item: Listing) {
  const {salaryMin, salaryMax, currency, experienceYears, applicationDeadline, jobType, workMode, employmentType, state, employerName} = item.data;
  const salaryCurrency = /^[A-Z]{3}$/.test(display(currency)) ? display(currency) : "INR";
  const formatAmount = (amount: unknown) => typeof amount === "number"
    ? new Intl.NumberFormat(salaryCurrency === "INR" ? "en-IN" : "en", {style: "currency", currency: salaryCurrency, maximumFractionDigits: 0}).format(amount)
    : "";
  const salary = [...new Set([formatAmount(salaryMin), formatAmount(salaryMax)].filter(Boolean))].join(" – ");
  const deadline = display(applicationDeadline);
  return [
    ["Employer", display(employerName)], ["Position", display(jobType)],
    ["Employment type", humanize(display(employmentType))], ["Work mode", workMode === "ON_SITE" ? "On-site" : humanize(display(workMode))],
    ["Location", [...new Set([display(item.data.locality), display(item.data.city), display(state), countryName(item.data.countryCode)].filter(Boolean))].join(", ")],
    ["Salary range", salary], ["Experience", typeof experienceYears === "number" ? (experienceYears === 0 ? "No prior experience required" : `${experienceYears} ${experienceYears === 1 ? "year" : "years"}`) : ""],
    ["Application deadline", /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? new Intl.DateTimeFormat("en-IN", {dateStyle: "long", timeZone: "UTC"}).format(new Date(deadline)) : ""],
  ].filter(([, value]) => value);
}

function ListingBadges({item, kind}: {item: Listing; kind: DirectoryKey}) {
  const intent = display(item.data.listingIntent).toUpperCase();
  const propertyType = display(item.data.propertyType);
  return (
    <>
      {kind === "properties" && intent === "SALE" && <span className={styles.badge}>For sale</span>}
      {kind === "properties" && intent === "RENT" && <span className={styles.badge}>For rent</span>}
      {kind === "properties" && propertyType && <span className={styles.badge}>{humanize(propertyType)}</span>}
      {kind === "dealers" && item.data.pro === true && <span className={styles.badge}><BadgeCheck size={14} aria-hidden="true" />Pro</span>}
      {kind === "jobs" && item.data.featured === true && <span className={styles.badge}><Sparkles size={14} aria-hidden="true" />Featured</span>}
      {kind === "materials" && (item.status === "OUT_OF_STOCK" || item.data.availabilityStatus === "OUT_OF_STOCK") && <span className={styles.badge}>Out of stock</span>}
      {kind === "workers" && (item.status === "AVAILABLE" || item.status === "BUSY") && <span className={styles.badge}>{humanize(item.status)}</span>}
    </>
  );
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

function ListingDetails({item, kind, locale}: {item: Listing; kind: DirectoryKey; locale: string}) {
  const images = listingImages(item);
  const [image, ...gallery] = images;
  const property = kind === "properties";
  const location = listingLocation(item);
  const price = cost(item);
  const facts = listingFacts(item, kind).filter(([, value]) => value);
  const job = kind === "jobs";
  const mediaLabel = kind === "professionals" ? "Portfolio photos" : "More photos";
  const specification = kind === "materials" ? display(item.data.specification) : "";
  const brochure = kind === "projects" ? safeHttpUrl(item.data.brochureUrl) : "";
  const locations = [["Area", display(item.data.locality ?? item.data.localityName)], ["City", display(item.data.city ?? item.data.cityName)],
    ["State or region", display(item.data.state)], ["Country or territory", countryName(item.data.countryCode)]].filter(([, value]) => value);
  const lists = job ? [["responsibilities", "Responsibilities"], ["qualifications", "Qualifications"], ["skills", "Skills"], ["benefits", "Benefits"]]
    : [["deliveryCities", "Delivery cities"], ["citiesServed", "Cities served"], ["serviceAreas", "Service areas"]];
  const socialLinks = kind === "dealers" && item.data.socialLinks && typeof item.data.socialLinks === "object" ? item.data.socialLinks as Record<string, unknown> : {};
  const dealerLinks = [["instagramUrl", "Instagram"], ["facebookUrl", "Facebook"], ["youtubeUrl", "YouTube"], ["linkedinUrl", "LinkedIn"], ["whatsappChannelUrl", "WhatsApp channel"]]
    .map(([key, label]) => ({label, url: safeHttpUrl(socialLinks[key])})).filter(({url}) => url);
  const priceQualifier = kind === "workers" ? " / day" : kind === "materials" && item.data.unit ? " / " + materialLabel(materialUnits, item.data.unit) : "";
  return (
    <article className={styles.detail}>
      {property && image && <PropertyGallery key={item.id} sources={images} title={item.title} />}
      <div className={!property && image ? styles.detailHero : undefined}>
        <header className={`${styles.detailHeading} ${property && image ? styles.propertyHeading : ""}`}>
          <div className={styles.badges}><ListingBadges item={item} kind={kind} /></div>
          <h1>{item.title}</h1>
          {job && display(item.data.employerName) && <p className={styles.jobEmployer}>{display(item.data.employerName)}</p>}
          {location && kind !== "materials" && <p className={styles.location}><MapPin size={16} aria-hidden="true" />{location}</p>}
        </header>
        {!property && image && <ListingPhoto key={image} source={image} alt={item.title} kind={kind} detail />}
      </div>
      <div className={styles.detailLayout}>
        <div className={styles.detailBody}>
          {facts.length > 0 && <section className={styles.surface}><h2>{listingFactHeadings[kind]}</h2><dl className={styles.facts}>
            {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl></section>}
          {item.description && <section className={styles.surface}><h2>Overview</h2><p className={styles.description}>{item.description}</p></section>}
          {specification && <section className={styles.surface}><h2>Technical specification</h2><p className={styles.description}>{specification}</p></section>}
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
          {!property && gallery.length > 0 && <section className={styles.surface}><h2>{mediaLabel}</h2><div className={styles.gallery}>
            {gallery.map((source, index) => <ListingPhoto key={source} source={source} alt={`${item.title}, photo ${index + 2}`} kind={kind} />)}
          </div></section>}
          {brochure && <section className={styles.surface}><h2>Project brochure</h2><a className={styles.detailLink} href={brochure} target="_blank" rel="noreferrer">Open brochure <ArrowUpRight size={16} aria-hidden="true" /></a></section>}
          {dealerLinks.length > 0 && <section className={styles.surface}><h2>Agency online</h2><ul className={styles.detailTags}>
            {dealerLinks.map(({label, url}) => <li key={label}><a className={styles.detailLink} href={url} target="_blank" rel="noreferrer">{label} <ArrowUpRight size={14} aria-hidden="true" /></a></li>)}
          </ul></section>}
        </div>
        <aside className={styles.surface} aria-label="Listing actions">
          <h2>{job ? "Apply for this role" : price ? <>{price}{priceQualifier && <small>{priceQualifier}</small>}</> : "Listing actions"}</h2>
          <ListingActions kind={kind} id={item.id} title={item.title} locale={locale} phone={display(item.data.phone)} whatsapp={display(item.data.whatsappPhone)} />
        </aside>
      </div>
    </article>
  );
}

function ListingCard({item, kind, locale}: {item: Listing; kind: DirectoryKey; locale: string}) {
  const [image] = listingImages(item);
  const location = listingLocation(item);
  const price = cost(item);
  const Icon = directories[kind].icon;
  const facts = kind === "properties" ? [
    {icon: BedDouble, value: display(item.data.bedrooms), label: "bedrooms"},
    {icon: Bath, value: display(item.data.bathrooms), label: "bathrooms"},
    {icon: Maximize, value: display(item.data.areaValue), label: display(item.data.areaUnit).replaceAll("_", " ").toLowerCase() || "area"},
  ].filter(({value}) => value) : [];
  const slug = kind === "dealers" ? display(item.data.slug) || item.id : item.id;
  const href = `/${locale}/${kind === "dealers" ? "dealer" : kind}/${encodeURIComponent(slug)}`;
  return (
    <article className={styles.card}>
      {image && <ListingPhoto key={image} source={image} alt="" kind={kind} />}
      <div className={styles.cardBody}>
        <div className={styles.cardMeta}>
          {!image && <span className={styles.cardIcon}><Icon size={19} aria-hidden="true" /></span>}
          <div className={styles.badges}><ListingBadges item={item} kind={kind} /></div>
        </div>
        <h2>{item.title}</h2>
        {location && <p className={styles.location}><MapPin size={15} aria-hidden="true" />{location}</p>}
        {item.description && <p className={`${styles.description} ${styles.cardDescription}`}>{item.description}</p>}
        {facts.length > 0 && <ul className={styles.cardFacts}>{facts.map(({icon: FactIcon, value, label}) => <li key={label}><FactIcon size={15} aria-hidden="true" />{value} {label}</li>)}</ul>}
        <footer className={styles.cardFooter}>
          {price && <strong>{price}{kind === "workers" && <small> / day</small>}</strong>}
          <Link className={styles.detailLink} href={href} aria-label={`View details for ${item.title}`}>View details <ArrowUpRight size={17} aria-hidden="true" /></Link>
        </footer>
      </div>
    </article>
  );
}

export function FeaturedProperties({locale}: {locale: string}) {
  const [listings, setListings] = useState<Listing[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<Listing[]>("/public/properties?limit=3", {signal: controller.signal})
      .then((items) => { if (!controller.signal.aborted) setListings(items); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (!listings.length) return null;
  return <section className={`market-width market-featured ${styles.featured}`} aria-labelledby="recent-properties">
    <div className="market-featured-heading">
      <h2 id="recent-properties">Recently listed properties</h2>
      <Link className={styles.secondaryButton} href={`/${locale}/properties`}>View all properties <ArrowUpRight size={16} aria-hidden="true" /></Link>
    </div>
    <div className={styles.grid}>{listings.map((item) => <ListingCard key={item.id} item={item} kind="properties" locale={locale} />)}</div>
  </section>;
}

export function MarketplaceDirectory({kind, locale, initialCity, initialIntent, initialCountry = "", initialCategory = "", initialPropertyType = "", selected}: {
  kind: DirectoryKey; locale: string; initialCity: string; initialIntent: string; initialCountry?: string; initialCategory?: string; initialPropertyType?: string; selected?: string;
}) {
  const [records, setRecords] = useState<Listing[] | null>(null);
  const [failure, setFailure] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [searchedKeyword, setSearchedKeyword] = useState("");
  const [city, setCity] = useState(initialCity);
  const [searchedCity, setSearchedCity] = useState(initialCity.trim());
  const [intent, setIntent] = useState(initialIntent);
  const [country, setCountry] = useState(initialCountry);
  const [category, setCategory] = useState(() => kind === "materials" ? materialOptionValue(materialCategories, initialCategory) ?? "" : initialCategory);
  const [propertyType, setPropertyType] = useState(initialPropertyType);
  const {place} = useSiteLocation();
  const supportsCountry = kind === "properties" || kind === "jobs" || kind === "dealers";
  const useNearby = !searchedCity && (!country || country === place?.countryCode);
  const nearCity = searchedCity || (useNearby ? place?.city : "") || "";
  const nearArea = useNearby ? place?.area || "" : "";
  const nearState = useNearby ? place?.state || "" : "";
  const nearCountry = (supportsCountry || kind === "materials") && useNearby ? place?.countryCode || "" : "";

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchedCity(city.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [city]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchedKeyword(query.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (selected) {
      params.set("item", selected);
      params.set("limit", "1");
    } else {
      setRecords(null);
      setFailure("");
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
    }
    apiRequest<Listing[]>("/public/" + kind + "?" + params.toString(), {signal: controller.signal})
      .then((results) => {
        if (!controller.signal.aborted) {
          setRecords(results);
          setFailure("");
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setFailure(error instanceof Error ? error.message : "Unable to load results.");
      });
    return () => controller.abort();
  }, [kind, attempt, nearArea, nearCity, nearState, nearCountry, searchedCity, searchedKeyword, supportsCountry, country, intent, category, propertyType, selected]);

  const matches = useMemo(() => (records ?? []).filter((item) => !selected || selected === item.id || selected === item.data.slug), [records, selected]);

  const prefix = "/" + locale;
  const Icon = directories[kind].icon;
  const filtersApplied = Boolean(query.trim() || city.trim() || intent || country || category || propertyType);
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
  }

  return (
    <>
      {selected ? (
        <Link className={styles.backLink} href={`${prefix}/${kind}`}>
          <ArrowLeft size={17} aria-hidden="true" />{directories[kind].title}
        </Link>
      ) : (
        <div className={styles.filters} role="group" aria-label="Filter marketplace results">
          <label className={styles.filterField}>
            <span>Keyword</span>
            <span className={styles.inputWrap}><Search size={17} aria-hidden="true" />
              <input type="search" placeholder="Search by keyword" value={query} onChange={(event) => setQuery(event.target.value)} />
            </span>
          </label>
          {supportsCountry && <label className={styles.filterField}>
            <span>Country or territory</span>
            <span className={`${styles.inputWrap} ${styles.selectWrap}`}>
              <select value={country} onChange={(event) => setCountry(event.target.value)}>
                <option value="">All countries</option>
                {listingCountries.map(({label, value}) => <option key={value} value={value}>{label}</option>)}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </span>
          </label>}
          <label className={styles.filterField}>
            <span>{kind === "materials" ? "Delivery city" : "Location"}</span>
            <span className={styles.inputWrap}><MapPin size={17} aria-hidden="true" />
              <input placeholder={kind === "materials" ? "e.g. Chandigarh" : "City or locality"} maxLength={120} value={city} onChange={(event) => setCity(event.target.value)} />
            </span>
          </label>
          {kind === "properties" && <label className={styles.filterField}>
            <span>Listing type</span>
            <span className={`${styles.inputWrap} ${styles.selectWrap}`}>
              <select value={intent} onChange={(event) => setIntent(event.target.value)}>
                <option value="">Buy or rent</option><option value="SALE">Buy</option><option value="RENT">Rent</option>
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </span>
          </label>}
          {kind === "materials" && <label className={styles.filterField}>
            <span>Material category</span>
            <span className={`${styles.inputWrap} ${styles.selectWrap}`}>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">All categories</option>
                {materialCategories.map(({label, value}) => <option key={value} value={value}>{label}</option>)}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </span>
          </label>}
          {kind !== "materials" && (category || propertyType) && <span className={styles.activeFilter}>{humanize(propertyType || category)}</span>}
          {filtersApplied && <button className={styles.clearButton} type="button" onClick={clearFilters}>
            <FilterX size={17} aria-hidden="true" />Clear filters
          </button>}
        </div>
      )}
      {!selected && records && (
        <div className="market-task-links">
          <p className={styles.resultCount} role="status"><strong>{matches.length}</strong> {matches.length === 1 ? "result" : "results"}{!city && place && (place.area || place.city || place.state) ? " · Nearby first" : ""}</p>
          {kind === "properties" && <Link className="market-text-link" href={publicTaskHref(locale, "properties/save-search", saveSearchParams)}>Save this search</Link>}
        </div>
      )}
      {failure ? (
        <div className={styles.state} role="alert">
          <span className={styles.stateIcon}><Icon size={24} aria-hidden="true" /></span>
          <h2>Results are unavailable</h2>
          <p>{failure}</p>
          <Button className={styles.primaryButton} onClick={() => {setFailure(""); setRecords(null); setAttempt((value) => value + 1);}}>Try again</Button>
        </div>
      ) : !records ? (
        <div className={styles.loading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          {selected ? "Loading details…" : "Loading results…"}
        </div>
      ) : matches.length === 0 ? (
        <div className={styles.state}>
          <span className={styles.stateIcon}><Search size={25} aria-hidden="true" /></span>
          <h2>{selected ? "This page is unavailable" : filtersApplied ? "No matching results" : "Nothing published yet"}</h2>
          <p>{selected ? "The listing may have been removed or unpublished." : filtersApplied ? "Try a broader search or clear the filters." : "Published listings and profiles will appear here."}</p>
          {selected ? <Link className={styles.secondaryButton} href={prefix + "/" + kind}>Back to results</Link>
            : filtersApplied ? <button type="button" className={styles.secondaryButton} onClick={clearFilters}>Clear filters</button>
            : <Link className={styles.secondaryButton} href={prefix + "/dashboard"}>Open workspace<ArrowUpRight size={16} aria-hidden="true" /></Link>}
        </div>
      ) : selected ? (
        <ListingDetails item={matches[0]} kind={kind} locale={locale} />
      ) : (
        <div className={styles.grid}>
          {matches.map((item) => <ListingCard key={item.id} item={item} kind={kind} locale={locale} />)}
        </div>
      )}
    </>
  );
}
