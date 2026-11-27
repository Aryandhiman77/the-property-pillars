import { useState } from "react";
import { Ellipsis } from "lucide-react";
import { useTranslations } from "next-intl";
import styles from "./dashboard.module.css";

export const listingSections = [
  {
    step: 1,
    stage: 0,
    label: "Property & project",
    keys: [
      "listingKind",
      "listingIntent",
      "propertyCategory",
      "propertyType",
      "propertyTypeOther",
      "projectOrSociety",
      "constructionStatus",
      "projectLaunchDate",
      "possessionDate",
      "availableFrom",
      "bedrooms",
      "bathrooms",
      "areaValue",
      "areaUnit",
      "totalFloors",
      "hasBasement",
      "basementLevel",
      "title",
    ],
  },
  {
    step: 3,
    stage: 0,
    label: "Location & registration",
    keys: [
      "countryCode",
      "postalCode",
      "state",
      "city",
      "locality",
      "addressLine",
      "googleMapsUrl",
      "reraApplicable",
      "reraAuthority",
      "reraNumber",
    ],
  },
  {
    step: 9,
    stage: 0,
    label: "Pricing",
    keys: [
      "priceMode",
      "price",
      "currency",
      "maxPrice",
      "priceFrequency",
      "securityDeposit",
      "maintenance",
    ],
  },
  { step: 10, stage: 1, label: "Photos & videos", keys: ["mediaUrls"] },
  {
    step: 8,
    stage: 1,
    label: "Amenities & parking",
    keys: [
      "evCharging",
      "parking",
      "openParkingArea",
      "coveredParkingArea",
      "furnishing",
      "furnishingItems",
      "amenities",
      "customAmenities",
      "instantDeliveryAvailable",
      "instantDeliveryApps",
      "instantDeliveryOther",
    ],
  },
  {
    step: 14,
    stage: 1,
    label: "Nearby places & description",
    keys: ["description", "contactPhone"],
  },
  { step: 17, stage: 2, label: "Listing cards", keys: [] },
  { step: 18, stage: 2, label: "Publication", keys: ["consentAccepted"] },
];
export const stageStarts = [1, 10, 17] as const;
export function listingSection(step: number) {
  // Older drafts store the original dashboard wizard's step number.
  return (
    listingSections.find((s) => s.step === step) ??
    listingSections[
      step === 2 || step === 4 || step === 5
        ? 0
        : step === 6 || step === 7
          ? 4
          : step <= 13
            ? 3
            : 5
    ]
  );
}
export function publicListingStage(step: number) {
  return listingSection(step).stage;
}
export function listingFieldSection(key: string) {
  return listingSections.find((s) => s.keys.includes(key))?.step ?? 1;
}

const stageLabels = [
  "propertyStageDetails",
  "propertyStageMedia",
  "propertyStageReview",
] as const;
export function ListingProgress({
  step,
  onStep,
  disabled,
  missing,
  labelForField,
  onClear,
}: {
  step: number;
  onStep: (step: number) => void;
  disabled: boolean;
  missing: string[];
  labelForField: (field: string) => string;
  onClear: () => void;
}) {
  const t = useTranslations("Site");
  const [menu, setMenu] = useState(false);
  const active = listingSection(step);
  const remaining = listingSections
    .filter(section => section.stage === active.stage)
    .flatMap(section => section.keys.filter(key => missing.includes(key)));
  return (
    <header className={styles.listingProgress}>
      <nav className={styles.listingStages} aria-label={t("listingStages")}>
        {stageLabels.map((label, i) => (
          <button
            type="button"
            key={label}
            disabled={disabled}
            aria-current={active.stage === i ? "step" : undefined}
            onClick={() => onStep(stageStarts[i])}
          >
            <span>{i + 1}</span>
            {t(label)}
          </button>
        ))}
      </nav>
      <div className={styles.substepHeading}>
        <strong>{remaining.length ? t("listingNeeded") : t(stageLabels[active.stage])}</strong>
        <div
          className={styles.listingMenu}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") setMenu(true);
          }}
          onPointerLeave={() => setMenu(false)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setMenu(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setMenu(false);
          }}
        >
          <button
            type="button"
            aria-label="Form options"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
          >
            <Ellipsis size={20} />
          </button>
          {menu && (
            <div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setMenu(false);
                  onClear();
                }}
              >
                Clear form
              </button>
            </div>
          )}
        </div>
      </div>
      {remaining.length > 0 && (
        <p className={styles.remainingFields}>
          {remaining.map(labelForField).join(" · ")}
        </p>
      )}
    </header>
  );
}
