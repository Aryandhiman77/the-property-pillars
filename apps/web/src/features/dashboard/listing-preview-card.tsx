import {useRef} from "react";
import Image from "next/image";
import {X} from "lucide-react";
import {useLocale} from "next-intl";
import {instantDeliveryProviders, isGoogleMapsLink, propertyAmenities, propertyFurnishingItems} from "@the-property-pillar/contracts";
import {imageSource} from "@/lib/image-source";
import {CompactPropertyCard, ListingCard} from "../marketplace/directory";
import {floorPlanLabel} from "../marketplace/floor-plan-label";
import {listingSections} from "./listing-progress";
import type {Charge, GalleryMeta, LocalPlace} from "./property-wizard";
import styles from "./dashboard.module.css";

type PreviewProps = {
  title: string;
  description: string;
  fields: Record<string, string | boolean | number>;
  fieldInfo: Record<string, {label: string; options?: {value: string; label: string}[]}>;
  amenityNames: Record<string, string>;
  units: Record<string, string>;
  charges: Charge[];
  places: LocalPlace[];
  media: string[];
  metadata: GalleryMeta[];
  isVideo: (url: string) => boolean;
  publication: string;
  poster: string;
};

export function ListingPreviewCard({title, description, fields, fieldInfo, amenityNames, units, charges, places, media, metadata, isVideo, publication, poster}: PreviewProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const locale = useLocale();
  const heading = title.trim() || String(fields.projectOrSociety || "Untitled property");
  const files = media.map(url => ({
    url: url.startsWith("blob:") || isVideo(url) ? url : imageSource(url),
    video: isVideo(url),
    details: metadata.find(entry => entry.url === url),
  })).filter(file => file.url);
  const item = {id: "preview", title: heading, description, status: publication, data: {
    ...fields,
    price: fields.price ? Number(fields.price) : undefined,
    maxPrice: fields.maxPrice ? Number(fields.maxPrice) : undefined,
    postedBy: poster ? {name: poster} : undefined,
  }};
  const variants = [
    {label: "Homepage card", card: <CompactPropertyCard item={item} locale={locale} draftMedia={files} />},
    {label: "Search results card", card: <ListingCard item={item} kind="properties" row locale={locale} draftMedia={files} />},
  ];
  function detailValue(key: string) {
    const value = fields[key];
    if (key === "googleMapsUrl" && isGoogleMapsLink(String(value))) {
      return <a href={String(value)} rel="noreferrer" target="_blank">{String(value)}</a>;
    }
    if (typeof value === "boolean") return value ? "Yes" : "No";
    const catalogs: Record<string, Record<string,string>> = {
      amenities: {...propertyAmenities, ...amenityNames}, instantDeliveryApps: instantDeliveryProviders, furnishingItems: propertyFurnishingItems,
    };
    if (catalogs[key]) return String(value).split(", ").map(code => catalogs[key][code] ?? code).join(", ");
    const text = fieldInfo[key]?.options?.find(option => option.value === value)?.label ?? String(value);
    const unit = key === "areaValue" || key.endsWith("Area") ? units[key] || fields.areaUnit :
      ["price", "maxPrice", "securityDeposit", "maintenance"].includes(key) ? fields.currency : "";
    return [text, unit].filter(Boolean).join(" ");
  }
  return <div className={styles.previewWrap}>
    <div className={styles.cardExamples}>
      {variants.map(({label, card}) => <section key={label}>
        <h3>{label}</h3>
        <div className={styles.cardExample}>
          <div inert>{card}</div>
          <button type="button" aria-label={`View property details from ${label}`} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()} />
        </div>
      </section>)}
    </div>
    <dialog ref={dialog} className={styles.listingPreviewDialog} aria-label="Property details" onClose={event => {
      event.currentTarget.querySelectorAll("video").forEach(video => video.pause());
    }}>
      <header><strong>Property details</strong><button type="button" aria-label="Close property details" onClick={() => dialog.current?.close()}><X /></button></header>
      <h2>{heading}</h2>
      {description && <p>{description}</p>}
      {files.length > 0 && <div className={styles.previewMedia}>{files.map(({url, video, details}) => <figure key={url}>
        {video ? <video controls preload="metadata" src={url} /> : <Image unoptimized src={url} alt={details?.alt || details?.category || heading} width={320} height={210} />}
        <figcaption>{[details?.category === "Floor plan" ? floorPlanLabel(details.floor) : details?.category, details?.classification, details?.caption].filter(Boolean).join(" · ")}</figcaption>
      </figure>)}</div>}
      {listingSections.map(section => {
        const keys = section.keys.filter(key => !["title","description","mediaUrls"].includes(key) && fields[key] !== undefined && fields[key] !== "");
        if (!keys.length && section.step !== 18) return null;
        return <section key={section.step}><h3>{section.label}</h3><dl>
          {keys.map(key => <div key={key}><dt>{fieldInfo[key]?.label || key}</dt><dd>{detailValue(key)}</dd></div>)}
          {section.step === 18 && <><div><dt>Listing status</dt><dd>{publication}</dd></div>{poster && <div><dt>Listed by</dt><dd>{poster}</dd></div>}</>}
        </dl></section>;
      })}
      {charges.length > 0 && <section><h3>Additional charges</h3><dl>{charges.map((charge, index) => <div key={index}>
        <dt>{charge.name}</dt><dd>{charge.currency} {charge.amount.toLocaleString(locale)} · {charge.frequency} · {charge.included ? "Included in asking price" : "Extra"}</dd>
      </div>)}</dl></section>}
      {places.length > 0 && <section><h3>Nearby places</h3><dl>{places.map((place, index) => <div key={index}>
        <dt>{place.name}</dt><dd>{[place.category, `${place.distance} ${place.unit}`, place.travelMinutes && `${place.travelMinutes} min`, place.mode].filter(Boolean).join(" · ")}</dd>
      </div>)}</dl></section>}
    </dialog>
  </div>;
}
