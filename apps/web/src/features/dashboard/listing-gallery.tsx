import {
  propertyGalleryLimit,
  propertyGallerySectionLimits,
  propertyGallerySection,
  isUploadedVideoUrl,
} from "@the-property-pillar/contracts";
import { ImageUpload } from "./image-upload";
import { MaterialInput, MaterialSelect } from "@/components/ui/material-fields";
import { floorPlanLabel } from "../marketplace/floor-plan-label";
import type { MediaDrafts } from "./media-drafts";
import type { GalleryMeta } from "./property-wizard";
import styles from "./dashboard.module.css";

const maxPlanFloor = 250;
const planFloorOptions = [
  -1, -2, -3, -4, -5,
  0, 1, 2, 3, 4, 5,
].map(floor => <option key={floor} value={floor}>{floorPlanLabel(floor)}</option>);

export function ListingGallery({
  urls,
  meta,
  drafts,
  onChange,
}: {
  urls: string[];
  meta: GalleryMeta[];
  drafts: MediaDrafts;
  onChange: (urls: string[], meta: GalleryMeta[]) => void;
}) {
  function updateFloor(url: string, floor?: number, pendingFloorInput?: string) {
    onChange(urls, meta.map(image => image.url === url
      ? {...image, floor, pendingFloorInput} : image));
  }

  function category(url: string) {
    return propertyGallerySection(meta.find(m => m.url === url)?.category,
      Boolean(drafts.file(url)?.type.startsWith("video/") || isUploadedVideoUrl(url)));
  }
  return (
    <div className={styles.galleryGrid}>
      {Object.entries(propertyGallerySectionLimits).map(([group, limit]) => {
        const selected = urls.filter((url) => category(url) === group);
        const remaining = Math.max(0, propertyGalleryLimit - urls.length);
        return (
          <section key={group}>
            <h3>{group}</h3>
            <ImageUpload
              label={group}
              kind={group === "Videos" ? "video" : "image"}
              name={group === "Interior" ? "mediaUrls" : undefined}
              maxFiles={limit}
              remainingSlots={remaining}
              purpose="properties:mediaUrls"
              drafts={drafts}
              value={selected.join(", ")}
              renderImageField={group === "Floor plan" ? (url, index) => {
                const {floor, pendingFloorInput} = meta.find(image => image.url === url) ?? {};
                const custom = pendingFloorInput !== undefined || (floor ?? 0) > 5;
                return <div className={styles.planFloorFields}>
                  <label>Floor
                    <MaterialSelect aria-label={`Floor for plan ${index + 1}`} value={custom ? "other" : floor ?? ""} onChange={event => {
                      const value = event.target.value;
                      if (value === "other") updateFloor(url, undefined, "");
                      else updateFloor(url, value === "" ? undefined : Number(value));
                    }}>
                      <option value="">{floorPlanLabel()}</option>
                      {planFloorOptions}
                      <option value="other">Another floor</option>
                    </MaterialSelect>
                  </label>
                  {custom && <label>Floor number
                    <MaterialInput type="number" min={6} max={maxPlanFloor} step={1} required
                      aria-label={`Floor number for plan ${index + 1}`} placeholder="6–250"
                      value={pendingFloorInput ?? floor ?? ""} onChange={event => {
                        const value = event.target.valueAsNumber;
                        if (Number.isInteger(value) && value >= 6 && value <= maxPlanFloor) updateFloor(url, value);
                        else updateFloor(url, undefined, event.target.value);
                      }} />
                    {pendingFloorInput && <small className={styles.fieldError}>Enter a whole number from 6 to 250.</small>}
                  </label>}
                </div>;
              } : undefined}
              onChange={(raw) => {
                const next = raw.split(", ").filter(Boolean);
                const retained = urls.filter(
                  (url) => !selected.includes(url) || next.includes(url),
                );
                let i = 0;
                const ordered = retained
                  .map((url) => (selected.includes(url) ? next[i++] : url))
                  .concat(next.slice(i));
                onChange(
                  ordered,
                  ordered.map(
                    (url) =>
                      meta.find((m) => m.url === url) ?? {
                        url,
                        category: group,
                      },
                  ),
                );
              }}
            />
          </section>
        );
      })}
    </div>
  );
}
