"use client";
import Image from "next/image";
import { useState } from "react";
import {
  AREA_UNITS,
  listingCurrencyCodes,
  propertySpecificationFields,
} from "@the-property-pillar/contracts";
import styles from "../marketplace/property-assets.module.css";

export type GalleryMeta = {
  url: string;
  category?: string;
  classification?: string;
  alt?: string;
  caption?: string;
};
export function PropertyMediaFields({
  urls,
  value,
  change,
}: {
  urls: string[];
  value: GalleryMeta[];
  change: (v: GalleryMeta[]) => void;
}) {
  function edit(url: string, k: keyof GalleryMeta, v: string) {
    const old = value.find((m) => m.url === url);
    change([...value.filter((m) => m.url !== url), { ...old, url, [k]: v }]);
  }
  return (
    <div className={styles.cards}>
      {urls.map((url, index) => {
        const item = value.find((v) => v.url === url);
        return (
          <details key={url}>
            <summary>
              Gallery item {index + 1}
              {index === 0 ? " · Cover" : ""}
            </summary>
            <div className={styles.editor}>
              <label>
                Classification
                <select
                  value={item?.classification ?? ""}
                  onChange={(e) => edit(url, "classification", e.target.value)}
                >
                  <option value="">Choose</option>
                  {[
                    "Actual photo",
                    "Sample unit",
                    "Architectural render",
                    "Construction progress",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Room or category
                <select
                  value={item?.category ?? ""}
                  onChange={(e) => edit(url, "category", e.target.value)}
                >
                  <option value="">Choose category</option>
                  {Array.from(
                    new Set([
                      "Cover",
                      "Living room",
                      "Bedroom",
                      "Bathroom",
                      "Kitchen",
                      "Balcony",
                      "Interior",
                      "Exterior",
                      "Building",
                      "Society",
                      "Amenities",
                      "Parking",
                      "View",
                      "Location",
                      "Construction progress",
                      "Other",
                      ...(item?.category ? [item.category] : []),
                    ]),
                  ).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              {(["caption", "alt"] as const).map((k) => (
                <label key={k}>
                  {k === "alt" ? "Accessible description" : "Caption"}
                  <input
                    maxLength={240}
                    value={item?.[k] ?? ""}
                    onChange={(e) => edit(url, k, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
export type LocalPlace = {
  name: string;
  category: string;
  distance: number;
  unit: "m" | "km" | "mi";
  travelMinutes?: number;
  mode?: string;
};
const categories = [
  "Metro",
  "Bus stop",
  "Railway station",
  "Airport",
  "School",
  "College",
  "Hospital",
  "Market",
  "Mall",
  "Park",
  "Highway",
  "Office hub",
  "Landmark",
  "Other",
];
export function NearbyEditor({
  value,
  change,
}: {
  value: LocalPlace[];
  change: (v: LocalPlace[]) => void;
}) {
  const [name, setName] = useState(""),
    [category, setCategory] = useState(categories[0]),
    [distance, setDistance] = useState(""),
    [unit, setUnit] = useState<LocalPlace["unit"]>("km"),
    [error, setError] = useState("");
  return (
    <section className={styles.section}>
      <h3>Nearby places</h3>
      <p>
        Add a landmark and its distance. Local map results also appear when
        available.
      </p>
      <div className={styles.editor}>
        <label>
          Place name
          <input
            maxLength={160}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Distance
          <input
            type="number"
            min={0}
            step="any"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
          />
        </label>
        <label>
          Unit
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as LocalPlace["unit"])}
          >
            {["m", "km", "mi"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            if (
              !name.trim() ||
              !distance ||
              +distance < 0 ||
              +distance > 10000
            ) {
              setError(
                "Enter the place name and a distance between 0 and 10,000.",
              );
              return;
            }
            change([
              ...value,
              { name: name.trim(), category, distance: +distance, unit },
            ]);
            setName("");
            setDistance("");
            setError("");
          }}
        >
          Add place
        </button>
        {error && <small role="alert">{error}</small>}
      </div>
      {value.map((v, i) => (
        <p key={i}>
          {v.name} · {v.distance} {v.unit}{" "}
          <button
            type="button"
            onClick={() => change(value.filter((_, j) => i !== j))}
          >
            Remove
          </button>
        </p>
      ))}
    </section>
  );
}

export type Charge = {
  name: string;
  amount: number;
  currency: string;
  frequency: string;
  included: boolean;
};
export type VideoTour = {
  title: string;
  kind: string;
  url: string;
  caption?: string;
  thumbnail?: string;
};
export function PropertyCharges({
  value,
  change,
  currency,
}: {
  value: Charge[];
  change: (charges: Charge[]) => void;
  currency: string;
}) {
  const [name, setName] = useState(""),
    [amount, setAmount] = useState(""),
    [unit, setUnit] = useState(""),
    [frequency, setFrequency] = useState("One time"),
    [included, setIncluded] = useState(false),
    [error, setError] = useState("");
  const selectedCurrency = unit || currency || "INR";
  return (
    <section className={styles.section}>
      <h3>Additional charges</h3>
      <div className={styles.editor}>
        <label>
          Charge name
          <input
            maxLength={240}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Amount
          <input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Currency
          <select
            value={selectedCurrency}
            onChange={(e) => setUnit(e.target.value)}
          >
            {listingCurrencyCodes.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Frequency
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
          >
            {[
              "One time",
              "Daily",
              "Weekly",
              "Monthly",
              "Quarterly",
              "Yearly",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={included}
            onChange={(e) => setIncluded(e.target.checked)}
          />{" "}
          Included in asking price
        </label>
        <button
          type="button"
          disabled={value.length >= 30}
          onClick={() => {
            if (
              !name.trim() ||
              !amount ||
              !Number.isFinite(+amount) ||
              +amount < 0 ||
              +amount > 1e15
            ) {
              setError("Enter a charge name and a valid amount.");
              return;
            }
            change([
              ...value,
              {
                name: name.trim(),
                amount: +amount,
                currency: selectedCurrency,
                frequency,
                included,
              },
            ]);
            setName("");
            setAmount("");
            setError("");
          }}
        >
          Add charge
        </button>
        {error && <small role="alert">{error}</small>}
      </div>
      {value.map((c, i) => (
        <p key={i}>
          {c.name} · {c.currency} {c.amount} · {c.frequency} ·{" "}
          {c.included ? "Included" : "Additional"}{" "}
          <button
            type="button"
            onClick={() => change(value.filter((_, j) => i !== j))}
          >
            Remove charge
          </button>
        </p>
      ))}
    </section>
  );
}
export function PropertyVideos({
  images,
  value,
  change,
}: {
  images: string[];
  value: VideoTour[];
  change: (v: VideoTour[]) => void;
}) {
  const [title, setTitle] = useState(""),
    [url, setUrl] = useState(""),
    [kind, setKind] = useState("Property walkthrough"),
    [thumbnail, setThumbnail] = useState(""),
    [caption, setCaption] = useState(""),
    [error, setError] = useState("");
  return (
    <section className={styles.section}>
      <h3>Video tours</h3>
      <div className={styles.editor}>
        <label>
          Video title
          <input
            value={title}
            maxLength={240}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Thumbnail
          <select
            value={thumbnail}
            onChange={(e) => setThumbnail(e.target.value)}
          >
            <option value="">No thumbnail</option>
            {images.map((u, i) => (
              <option key={u} value={u}>
                Gallery photo {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tour type
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {[
              "Property walkthrough",
              "Interior tour",
              "Exterior tour",
              "Building or society",
              "Neighbourhood",
              "Construction update",
              "Other",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          YouTube or Vimeo link
          <input
            type="url"
            maxLength={500}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <label>
          Caption
          <input
            value={caption}
            maxLength={240}
            onChange={(e) => setCaption(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={value.length >= 20}
          onClick={() => {
            let link: URL;
            try {
              link = new URL(url);
            } catch {
              setError("Enter a valid video link.");
              return;
            }
            if (
              !title.trim() ||
              link.protocol !== "https:" ||
              link.username ||
              link.password ||
              ![
                "www.youtube.com",
                "youtube.com",
                "youtu.be",
                "vimeo.com",
                "www.vimeo.com",
              ].includes(link.hostname)
            ) {
              setError("Enter a title and an HTTPS YouTube or Vimeo link.");
              return;
            }
            change([
              ...value,
              {
                title: title.trim(),
                url: link.href,
                kind,
                caption: caption.trim(),
                ...(thumbnail && images.includes(thumbnail)
                  ? { thumbnail }
                  : {}),
              },
            ]);
            setTitle("");
            setUrl("");
            setCaption("");
            setError("");
          }}
        >
          Attach video
        </button>
        {error && <small role="alert">{error}</small>}
      </div>
      {value.map((v, i) => (
        <p key={i}>
          <a href={v.url} target="_blank" rel="noreferrer">
            {v.title}
          </a>{" "}
          <button
            type="button"
            disabled={i === 0}
            onClick={() => {
              const copy = [...value];
              [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]];
              change(copy);
            }}
          >
            Move up
          </button>
          <button
            type="button"
            disabled={i === value.length - 1}
            onClick={() => {
              const copy = [...value];
              [copy[i + 1], copy[i]] = [copy[i], copy[i + 1]];
              change(copy);
            }}
          >
            Move down
          </button>
          <button
            type="button"
            onClick={() => change(value.filter((_, j) => i !== j))}
          >
            Remove video
          </button>
        </p>
      ))}
    </section>
  );
}
export function PropertyAreaUnits({
  data,
  value,
  change,
}: {
  data: Record<string, unknown>;
  value: Record<string, string>;
  change: (m: Record<string, string>) => void;
}) {
  const keys = [
    "carpetArea",
    "builtUpArea",
    "superBuiltUpArea",
    "plotArea",
    "gardenArea",
    "terraceArea",
    "balconyArea",
    "officeArea",
    "coveredArea",
    "yardArea",
  ].filter((k) => data[k] != null && data[k] !== "");
  if (!keys.length) return null;
  return (
    <div className={styles.editor}>
      {keys.map((key) => (
        <label key={key}>
          {propertySpecificationFields[key]?.[1] ?? key} unit
          <select
            value={value[key] ?? ""}
            onChange={(e) => {
              const m = { ...value };
              if (e.target.value) m[key] = e.target.value;
              else delete m[key];
              change(m);
            }}
          >
            <option value="">Use property size unit</option>
            {AREA_UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
export function PropertyPreview({
  title,
  description,
  data,
  media,
  videoSources,
  role,
}: {
  title: string;
  description: string;
  data: Record<string, unknown>;
  media: string[];
  videoSources: string[];
  role?: string;
}) {
  return (
    <section className={styles.section}>
      <h3>{title || "Untitled property"}</h3>
      <p>{[data.locality, data.city, data.state].filter(Boolean).join(", ")}</p>
      <p>
        {role} · {String(data.listingIntent || "")} ·{" "}
        {String(data.propertyType || "").replaceAll("_", " ")}
      </p>
      <div className={styles.cards}>
        {media
          .slice(0, 4)
          .map((url, i) =>
            videoSources.includes(url) ? (
              <video key={url} controls src={url} width="160" />
            ) : (
              <Image
                unoptimized
                key={url}
                src={url}
                alt={"Gallery " + (i + 1)}
                width={160}
                height={110}
                style={{ objectFit: "contain" }}
              />
            ),
          )}
      </div>
      <p>{description}</p>
      <dl>
        {Object.entries(data)
          .filter(
            ([k, v]) =>
              v !== "" &&
              v != null &&
              v !== false &&
              !["mediaUrls", "aboutPropertyHtml", "contactPhone"].includes(k),
          )
          .map(([k, v]) => (
            <div key={k}>
              <dt>
                {propertySpecificationFields[k]?.[1] ??
                  k.replace(/([a-z])([A-Z])/g, "$1 $2")}
              </dt>
              <dd>
                {Array.isArray(v)
                  ? v
                      .map((entry) =>
                        typeof entry === "object"
                          ? Object.values(entry).join(" · ")
                          : String(entry),
                      )
                      .join(", ")
                  : String(v).replaceAll("_", " ")}
              </dd>
            </div>
          ))}
      </dl>
    </section>
  );
}
