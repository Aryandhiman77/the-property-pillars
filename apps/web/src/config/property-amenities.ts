import {propertyAmenityValues} from "@the-property-pillar/contracts";

const labels = {
  parking: "Parking",
  furnishing: "Furnishing",
  powerBackup: "Power backup",
} as const;

const optionLabels: Record<(typeof propertyAmenityValues)[keyof typeof propertyAmenityValues][number], string> = {
  NO_PARKING: "No parking",
  OPEN_PARKING: "Open parking",
  COVERED_PARKING: "Covered parking",
  OPEN_AND_COVERED: "Open and covered parking",
  UNFURNISHED: "Unfurnished",
  SEMI_FURNISHED: "Semi-furnished",
  FULLY_FURNISHED: "Fully furnished",
  NO_BACKUP: "No backup",
  PARTIAL_BACKUP: "Partial backup",
  FULL_BACKUP: "Full backup",
};

export const propertyAmenityFields = (Object.keys(propertyAmenityValues) as (keyof typeof propertyAmenityValues)[])
  .map((key) => ({key, label: labels[key], options: propertyAmenityValues[key].map((value) => ({value, label: optionLabels[value]}))}));
