"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BadgeCheck, Building2, MapPin } from "lucide-react";
import { apiRequest } from "@/lib/api/client";
import { imageSource, safeHttpUrl } from "@/lib/image-source";
import { LoadingRows } from "@/components/ui/loading-skeleton";
import { CompactPropertyCard, type Listing } from "./directory";
import { ListingGridSkeleton } from "./listing-grid-skeleton";
import { PropertyGallery } from "./property-gallery";
import { PropertyContact } from "./property-contact";
import {OfficeLocation, type BusinessOffice} from "./office-location";
import css from "./advertiser-profile.module.css";

type Profile = {
  verified:boolean;
  featured:boolean;
  name: string;
  representative: string;
  role: string;
  logo?: string;
  about?: string;
  website?: string;
  office?: BusinessOffice;
  businessEmail?: string;
  gallery: {url:string;title:string}[];
  memberSince: string;
  cities: string[];
  localities: string[];
  specializations: string[];
  total: number;
  sale: number;
  rent: number;
  contact: {
    id: string;
    masked?:string;
    phone: boolean;
    whatsapp: boolean;
    phoneEnquiry: boolean;
    whatsappEnquiry: boolean;
  };
};
type Properties = { items: Listing[]; total: number; pageSize: number };
function useSection<T>(path: string) {
  const [result, setResult] = useState<{
    path: string;
    data?: T;
    error?: string;
  }>();
  const [attempt, retry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    apiRequest<T>(path, { signal: abort.signal })
      .then((data) => {
        if (!abort.signal.aborted) setResult({ path, data });
      })
      .catch((error: Error) => {
        if (!abort.signal.aborted) setResult({ path, error: error.message });
      });
    return () => abort.abort();
  }, [path, attempt]);
  return {
    ...(result?.path === path ? result : {}),
    retry: () => {
      setResult(undefined);
      retry((n) => n + 1);
    },
  };
}

export function AdvertiserProfile({
  id,
  locale,
}: {
  id: string;
  locale: string;
}) {
  const [page, setPage] = useState(1);
  const [galleryOpen,setGalleryOpen] = useState(false);
  const [badLogo, setBadLogo] = useState(false);
  const profile = useSection<Profile>(
    "/public/listing-profiles/" + encodeURIComponent(id),
  );
  const listings = useSection<Properties>(
    "/public/properties/search?" +
      new URLSearchParams({ advertiser: id, page: String(page) }),
  );
  const p = profile.data;
  const items = listings.data;
  const logo =
    p?.logo &&
    (/^\/api\/v1\/profiles\/files\/[\w-]+$/.test(p.logo)
      ? p.logo
      : imageSource(p.logo));
  const gallery = (p?.gallery ?? []).map(photo => ({url:imageSource(photo.url),alt:photo.title,caption:photo.title})).filter(photo=>photo.url);
  const website = safeHttpUrl(p?.website);
  const role =
    p?.role === "DEALER"
      ? "Property dealer"
      : p?.role === "BUILDER"
        ? "Builder"
        : "Property owner";
  const areas = p && [...new Set([...p.cities, ...p.localities])];
  function move(next: number) {
    setPage(next);
    document
      .getElementById("advertiser-properties")
      ?.scrollIntoView({ block: "start", behavior: "instant" });
  }
  return (
    <div className={css.page}>
      {profile.error ? (
        <section role="alert">
          <p>{profile.error}</p>
          <button onClick={profile.retry}>Retry profile</button>
        </section>
      ) : !p ? (
        <section aria-label="Advertiser profile" className={css.hero}>
          <LoadingRows label="Loading advertiser profile" count={3} />
        </section>
      ) : (
        <>
          <header className={css.hero}>
            <div className={css.identity}>
              <div className={css.logo}>
                {logo && !badLogo ? (
                  <Image
                    unoptimized
                    src={logo}
                    alt={p.name + " logo"}
                    width={100}
                    height={100}
                    onError={() => setBadLogo(true)}
                  />
                ) : (
                  <span aria-hidden="true">
                    {p.name
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((word) => Array.from(word)[0])
                      .join("")}
                  </span>
                )}
              </div>
              <div>
                <p className={css.role}>
                  <Building2 size={16} />
                  {role}
                </p>
                {p.featured && <small className={css.featuredLabel} data-shine="true">Featured{p.role==="BUILDER"?" · Premium":""}</small>}
                <h1>{p.name} {p.verified && <BadgeCheck className="market-verified" aria-label="Verified profile"/>}</h1>
                {p.representative !== p.name && <p>{p.representative}</p>}
                {p.cities.length > 0 && (
                  <p className={css.location}>
                    <MapPin size={16} />
                    {p.cities.join(", ")}
                  </p>
                )}
              </div>
            </div>
            <dl className={css.stats}>
              {[
                [p.total, "Published properties"],
                [p.sale, "For sale"],
                [p.rent, "For rent / lease"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </header>
          <div className={css.info}>
            <section className={css.panel}>
              <h2>About {p.name}</h2>
              {p.about && <p>{p.about}</p>}
              <p>
                Member since{" "}
                {new Intl.DateTimeFormat(locale, {
                  month: "long",
                  year: "numeric",
                }).format(new Date(p.memberSince))}
              </p>
              {p.specializations.length > 0 && (
                <p>{p.specializations.join(" · ")}</p>
              )}
              {website && (
                <a data-shine="true" className="market-website-link" href={website} target="_blank" rel="noopener noreferrer">
                  Visit website
                </a>
              )}
              {areas && areas.length > 0 && (
                <>
                  <h3>Operates in</h3>
                  <ul className={css.areas}>
                    {areas.map((area) => (
                      <li key={area}>{area}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
            <section className={css.panel}>
              <h2>Contact {p.name}</h2>
              {p.businessEmail && <a href={"mailto:"+p.businessEmail}>{p.businessEmail}</a>}
              <PropertyContact
                key={p.contact.id}
                id={p.contact.id}
                locale={locale}
                masked={p.contact.masked}
                advertiser={{ ...p.contact, id }}
              />
            </section>
          </div>
          <OfficeLocation office={p.office} name={p.name}/>
          {gallery.length > 0 && <details className={css.gallery} onToggle={event=>setGalleryOpen(event.currentTarget.open)}>
            <summary>Property gallery ({gallery.length})</summary>
            {galleryOpen && <PropertyGallery title={p.name} sources={gallery.map(photo=>photo.url)} metadata={gallery}/>}
          </details>}
        </>
      )}
      <section id="advertiser-properties" className={css.properties}>
        <h2>Listed properties</h2>
        {listings.error ? (
          <div role="alert">
            <p>{listings.error}</p>
            <button onClick={listings.retry}>Retry properties</button>
          </div>
        ) : !items ? (
          <ListingGridSkeleton kind="properties" />
        ) : items.items.length ? (
          <div className={css.grid}>
            {items.items.map((item) => (
              <CompactPropertyCard key={item.id} item={item} locale={locale} />
            ))}
          </div>
        ) : (
          <p>No published properties.</p>
        )}
        {items && items.total > items.pageSize && (
          <nav aria-label="Advertiser property pages" className={css.pages}>
            <button disabled={page === 1} onClick={() => move(page - 1)}>
              Previous
            </button>
            <span>
              Page {page} of {Math.ceil(items.total / items.pageSize)}
            </span>
            <button
              disabled={page * items.pageSize >= items.total}
              onClick={() => move(page + 1)}
            >
              Next
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}
