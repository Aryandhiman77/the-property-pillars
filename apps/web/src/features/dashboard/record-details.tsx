import Image from "next/image";
import {ArrowUpRight, Play} from "lucide-react";
import {isUploadedVideoUrl, leadVisitorLabels, type LeadVisitorType, materialCategories, materialOptionValue, materialUnits, propertyAmenities, propertyGalleryUrls, propertyReportReasons, type PropertyReportReason} from "@the-property-pillar/contracts";
import {countryName} from "@/config/listing-geography";
import {imageSource, safeHttpUrl} from "@/lib/image-source";
import {isResumePath} from "@/features/marketplace/resume-upload";
import {prettifyKey} from "./collection-config";
import type {CollectionDescriptor, FieldDescriptor} from "./types";
import styles from "./record-details.module.css";

const internalKeys = new Set(["listingReference", "consentAcceptedAt", "deliveryCityOptions", "materialCategoryIds", "nearbyPlaces"]);
const extraLabels: Record<string, string> = {items: "Materials", grandTotal: "Quote total", socialLinks: "Social links", visitorType: "Visitor type"};
const numericFormat = new Intl.NumberFormat("en-IN", {maximumFractionDigits: 4});

function hasValue(value: unknown) {
  if (value == null || value === "") return false;
  if (Array.isArray(value)) return value.some(hasValue);
  return typeof value !== "object" || Object.values(value).some(hasValue);
}

function scalar(value: unknown, field?: FieldDescriptor) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return numericFormat.format(value);
  if (typeof value !== "string") return "";
  if (field?.type === "date" || field?.type === "datetime") {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return new Intl.DateTimeFormat("en-IN", field.type === "date"
      ? {dateStyle: "medium", timeZone: "UTC"} : {dateStyle: "medium", timeStyle: "short"}).format(date);
  }
  if (field?.key === "countryCode") return countryName(value) || value;
  return field?.options?.find(({value: option}) => option === value)?.label ?? value;
}

function recordLink(value: string, label: string) {
  if (isResumePath(value)) return <a href={value} download>Download résumé</a>;
  const url = safeHttpUrl(value);
  return url ? <a href={url} rel="noreferrer" target="_blank">{label} <ArrowUpRight size={13} aria-hidden="true" /></a> : value;
}

function RecordValue({field, value}: {field?: FieldDescriptor; value: unknown}) {
  if (field?.type === "rich-text" && typeof value === "string") {
    return <div className={styles.richText} dangerouslySetInnerHTML={{__html: value}} />;
  }
  if (field?.type === "image" || field?.type === "images" || field?.type === "media") {
    const sources = [...new Set((Array.isArray(value) ? value : [value]).map((entry) => field.type === "media" && isUploadedVideoUrl(entry) ? entry : imageSource(entry)).filter(Boolean))];
    return sources.length ? <ul className={styles.media}>{sources.map((src, index) => <li key={src}>
      <a href={src} target="_blank" rel="noreferrer" aria-label={`Open ${field.label.toLowerCase()} ${index + 1}`}>
        {isUploadedVideoUrl(src) ? <span className={styles.videoPreview}><Play size={20} aria-hidden="true" /> Video</span>
          : <Image src={src} alt={`${field.label} ${index + 1}`} fill sizes="120px" unoptimized />}
      </a>
    </li>)}</ul> : <span>Image preview unavailable</span>;
  }
  if (typeof value === "string") {
    if (field?.type === "resume" || field?.type === "url" || safeHttpUrl(value)) return recordLink(value, field?.key === "brochureUrl" ? "Open brochure" : "Open link");
    return scalar(value, field);
  }
  if (Array.isArray(value)) return <ul className={styles.tags}>{value.filter(hasValue).map((entry, index) => <li key={index}>{scalar(entry, field)}</li>)}</ul>;
  if (typeof value === "object" && value !== null) return <dl className={styles.nested}>{Object.entries(value).filter(([, entry]) => hasValue(entry)).map(([key, entry]) => (
    <div key={key}><dt>{prettifyKey(key).replace(/ Url$/, "")}</dt><dd>{typeof entry === "string" && key.endsWith("Url") ? recordLink(entry, "Open link") : scalar(entry)}</dd></div>
  ))}</dl>;
  return scalar(value, field);
}

export function RecordDetails({descriptor, data, errors = {}}: {descriptor: CollectionDescriptor; data: Record<string, unknown>; errors?: Record<string, string>}) {
  const knownKeys = new Set(descriptor.fields.map(({key}) => key));
  const values = descriptor.fields.map((field) => {
    let value = data[field.key];
    if (field.type === "media") value = propertyGalleryUrls(data);
    if (field.key === "deliveryCityIds") value = data.deliveryCities;
    if (field.key === "cityId") value = data.city;
    if (field.key === "amenities" && Array.isArray(value)) value = value.map((entry) => propertyAmenities[entry as keyof typeof propertyAmenities] ?? entry);
    return {key: field.key, label: field.label, field, value};
  });
  if (descriptor.key === "properties") knownKeys.add("videoUrl");
  if (descriptor.key === "materialRfqs") knownKeys.add("city");
  if (descriptor.key === "materialProducts") knownKeys.add("deliveryCities");
  const visitor = leadVisitorLabels[data.visitorType as LeadVisitorType] ?? (data.isDealer === true ? leadVisitorLabels.DEALER : undefined);
  const extra = Object.entries({...data, visitorType: visitor, reportReason: propertyReportReasons[data.reportReason as PropertyReportReason] ?? data.reportReason}).filter(([key]) => !knownKeys.has(key) && !internalKeys.has(key) && key !== "items" && key !== "isDealer")
    .map(([key, value]) => ({key, value: key === "grandTotal" && typeof value === "number" && typeof data.currency === "string"
      ? `${numericFormat.format(value)} ${data.currency}` : value, label: extraLabels[key] ?? prettifyKey(key), field: undefined}));
  const details = [...values, ...extra].filter(({key, value}) => hasValue(value) || errors[key]);
  const lines = Array.isArray(data.items) ? data.items.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Record<string, unknown>[] : [];

  return <div className={styles.recordDetails}>
    {details.length > 0 && <dl className={styles.details}>
      {details.map(({key, label, value, field}) => <div className={Array.isArray(value) || typeof value === "object" || field?.type === "image" || field?.type === "rich-text" ? styles.wide : undefined} key={key}>
        <dt>{label}</dt><dd><RecordValue field={field} value={value} />
          {errors[key] && <small className={styles.detailError} role="alert" tabIndex={-1}>{errors[key]}</small>}
        </dd>
      </div>)}
    </dl>}
    {(lines.length > 0 || errors.items) && <div className={styles.lines}>
      <h4>{descriptor.key === "materialQuotes" ? "Quoted materials" : "Materials needed"}</h4>
      <ol>{lines.map(({itemName, ...fields}, index) => <li key={index}>
        <strong>{scalar(itemName) || `Material ${index + 1}`}</strong>
        <dl className={styles.nested}>{Object.entries(fields).filter(([, value]) => hasValue(value)).map(([key, value]) => {
          const label = key === "unit" ? materialUnits.find((option) => option.value === materialOptionValue(materialUnits, value))?.label :
            key === "category" ? materialCategories.find((option) => option.value === materialOptionValue(materialCategories, value))?.label : undefined;
          return <div key={key}><dt>{prettifyKey(key)}</dt><dd>{label ?? scalar(value)}{key === "unitPrice" && typeof data.currency === "string" ? ` ${data.currency}` : ""}</dd></div>;
        })}</dl>
      </li>)}</ol>
      {errors.items && <small className={styles.detailError} role="alert" tabIndex={-1}>{errors.items}</small>}
    </div>}
    {!details.length && !lines.length && !errors.items && <p className={styles.empty}>No additional details submitted.</p>}
  </div>;
}
