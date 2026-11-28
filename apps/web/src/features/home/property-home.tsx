"use client";

import {FreeBadge} from "@/components/ui/free-badge";
import MuiButton from "@mui/material/Button";

import Image from "next/image";
import Link from "next/link";
import {useTranslations} from "next-intl";
import {ArrowUpRight, ChevronLeft, ChevronRight, MapPin} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import {marketplaceArtwork, propertyListingHref} from "@/config/marketplace";
import {apiRequest} from "@/lib/api/client";
import {imageSource} from "@/lib/image-source";
import {Skeleton, SkeletonStatus} from "@/components/ui/loading-skeleton";
import cityImages from "./city-images.json";
import styles from "./property-home.module.css";

const serviceLinks = [
  {title: "Buy commercial property", description: "Find shops, offices and commercial space for sale.", route: "/properties?intent=SALE&segment=COMMERCIAL", image: "projects"},
  {title: "Rent commercial property", description: "Browse offices, showrooms and warehouses to lease.", route: "/properties?intent=RENT&segment=COMMERCIAL", image: "dealers"},
  {title: "Buy plots & land", description: "Explore residential, commercial and industrial plots.", route: "/properties?intent=SALE&segment=PLOT_LAND", image: "properties"},
  {title: "Rent a home", description: "Find apartments, townhouses and independent homes.", route: "/properties?intent=RENT&segment=RESIDENTIAL", image: "architecture"},
  {title: "Buy a home", description: "Browse apartments, villas and independent homes for sale.", route: "/properties?intent=SALE&segment=RESIDENTIAL", image: "properties"},
  {title: "Post property", description: "Publish a property for sale or rent.", route: "", image: "professionals"},
] as const;

export function ExplorePropertyServices({locale}: {locale: string}) {
  const t = useTranslations("Site");
  return <section className={`market-width market-architecture-backdrop ${styles.services}`} aria-labelledby="market-services">
    <div className={styles.serviceBanner}>
      <Image alt="" src={marketplaceArtwork.interior} sizes="(max-width: 800px) calc(100vw - 32px), (max-width: 1120px) calc(100vw - 52px), (max-width: 1240px) calc(100vw - 80px), 1160px" fill />
      <h2 id="market-services">{t("exploreProperties")}</h2>
    </div>
    <div className={styles.serviceGrid}>
      {serviceLinks.map(({title, description, route, image}) => <Link key={title}
        href={route ? "/" + locale + route : propertyListingHref(locale)} className={styles.serviceCard}>
        <Image alt="" width={104} height={82} src={image === "architecture" ? marketplaceArtwork.hero : marketplaceArtwork.banner(image)} />
        <span><strong>{title} {!route && <FreeBadge />}</strong><span>{description}</span></span>
        <ArrowUpRight size={15} aria-hidden="true" />
      </Link>)}
    </div>
  </section>;
}

type City = {cityId: string | null; city: string; country: string; state: string; count: number; image: string | null};
type CityImage = {image: string; city: string; source: string; author: string; license: string; licenseUrl: string | null};
const catalog: Record<string, CityImage> = cityImages;
const imageAliases: Record<string, string> = {bengaluru: "bengaluru", bangalore: "bengaluru", delhi: "new_delhi", gurugram: "gurgaon", new_york: "new_york_city", singapur: "singapore"};
const cityNamesByCountry: Record<string, string> = {
  mumbai: "IN", new_delhi: "IN", bengaluru: "IN", london: "GB", dubai: "AE", singapore: "SG", new_york_city: "US",
  toronto: "CA", sydney: "AU", paris: "FR", ambala: "IN", panchkula: "IN", gurgaon: "IN", noida: "IN",
};

function cityPhoto({city, country}: City) {
  const normalized = city.toLowerCase().normalize("NFKD").replace(/\p{Mark}/gu, "").replace(/\s+/g, "_");
  const key = imageAliases[normalized] ?? normalized;
  return cityNamesByCountry[key] === country ? catalog[key] : undefined;
}

function CityPicture({src}: {src: string}) {
  const [failed, setFailed] = useState(false);
  const image = failed ? marketplaceArtwork.banner("properties") : src;
  return <Image src={image} alt="" width={112} height={96} loading="eager" unoptimized onError={() => setFailed(true)} />;
}

export function CitySearchLinks({locale,label}:{locale:string;label:string}) {
  const [cities,setCities]=useState<City[]>([]);
  useEffect(()=>{
    const controller=new AbortController();
    apiRequest<City[]>("/public/properties/top-cities",{signal:controller.signal})
      .then(rows=>{if(!controller.signal.aborted)setCities(rows.slice(0,4))}).catch(()=>{});
    return ()=>controller.abort();
  },[]);
  if (!cities.length) return null;
  return <div className="market-cities"><span><MapPin size={15} aria-hidden="true"/>{label}</span>
    {cities.map(city=><Link key={city.country+city.city} href={citySearchHref(locale,city)}>{city.city}</Link>)}
  </div>;
}

function citySearchHref(locale:string,city:City){
  return `/${locale}/properties?${new URLSearchParams({place:JSON.stringify({kind:"city",value:city.city,country:city.country})})}`;
}

export function TopPropertyCities({locale}: {locale: string}) {
  const [cities, setCities] = useState<City[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const slider = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    void apiRequest<City[]>("/public/properties/top-cities", {signal: controller.signal})
      .then((items) => {if (!controller.signal.aborted) setCities(items);}, () => {if (!controller.signal.aborted) setFailed(true);});
    return () => controller.abort();
  }, [retry]);

  function scroll(direction: number) {
    const track = slider.current;
    if (!track) return;
    const rtl = getComputedStyle(track).direction === "rtl";
    track.scrollBy({left: track.clientWidth * direction * (rtl ? -1 : 1), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
  }

  const credits = [...new Map((cities ?? []).flatMap((city) => {
    const asset = cityPhoto(city);
    return asset ? [[asset.source, asset] as const] : [];
  })).values()];
  const numbers = new Intl.NumberFormat(locale);
  const countries = new Intl.DisplayNames([locale], {type: "region"});
  return <section className={`market-width market-architecture-backdrop ${styles.cities}`} aria-labelledby="top-property-cities">
    <div className="market-featured-heading">
      <h2 id="top-property-cities">Top cities</h2>
      {cities?.length ? <div className={styles.arrows}>
        <MuiButton type="button" aria-label="Previous cities" onClick={() => scroll(-1)}><ChevronLeft size={19} aria-hidden="true" /></MuiButton>
        <MuiButton type="button" aria-label="Next cities" onClick={() => scroll(1)}><ChevronRight size={19} aria-hidden="true" /></MuiButton>
      </div> : null}
    </div>
    {failed ? <p role="alert">Could not load cities. <MuiButton type="button" onClick={() => setRetry((value) => value + 1)}>Retry</MuiButton></p>
      : !cities ? <SkeletonStatus label="Loading top cities" className={styles.cityGrid}>
        {Array.from({length: 8}, (_, index) => <Skeleton className={styles.citySkeleton} key={index} />)}
      </SkeletonStatus>
        : <div className={styles.cityGrid} ref={slider}>{cities.map((city) => {
          const src = cityPhoto(city)?.image || imageSource(city.image) || marketplaceArtwork.banner("properties");
          const count = numbers.format(city.count);
          return <Link key={city.cityId ?? city.country + city.state + city.city} href={citySearchHref(locale,city)} className={styles.cityCard}>
            <CityPicture key={src} src={src} />
            <span><strong>{city.city}</strong><span>{countries.of(city.country)} · {count} {city.count === 1 ? "property" : "properties"}</span></span>
          </Link>;
        })}</div>}
    {credits.length > 0 && <details className={styles.credits}>
      <summary>City photo credits</summary>
      <ul>{credits.map(({city, source, author, license, licenseUrl}) => <li key={source}>
        <a href={source} target="_blank" rel="noreferrer">{city}</a> · {author || "Wikimedia Commons"} · {licenseUrl ? <a href={licenseUrl} target="_blank" rel="noreferrer">{license}</a> : license}. Resized for this site.
      </li>)}</ul>
    </details>}
  </section>;
}
