import sanitizeHtml from "sanitize-html";
import {z} from "zod";
import {instantDeliveryProviders, propertyDetailLimits, propertyFurnishingItems, propertyKitchenTypes} from "@the-property-pillar/contracts";

const color = /^(?:#[\da-f]{3,8}|rgba?\([\d.,% /]+\)|hsla?\([\d.,% /]+\)|[a-z]{3,20})$/i;
const allowedStyles = {color: [color], "background-color": [color], "text-align": [/^(left|right|center|justify)$/]};

export function sanitizePropertyHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "h2", "h3", "h4", "strong", "em", "b", "i", "u", "s", "span", "ol", "ul", "li", "blockquote", "a"],
    allowedAttributes: {"*": ["style"], a: ["href", "title"]},
    allowedStyles: {"*": allowedStyles},
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
  }).trim();
}

function catalogSelections<T extends Record<string, string>>(catalog: T) {
  return z.array(z.string().refine((value) => Object.hasOwn(catalog, value), "Choose one of the available options."))
    .max(Object.keys(catalog).length).transform((values) => [...new Set(values)]).optional();
}

function uniqueItems<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = key(item).toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

const textItems = (limit: number, size: number) => z.array(z.string().trim().min(2).max(size)).max(limit)
  .transform((items) => uniqueItems(items, (item) => item)).optional();

export function normalizePropertyKitchen(input: Record<string, unknown>): Record<string, unknown>;
export function normalizePropertyKitchen(input: unknown): unknown;
export function normalizePropertyKitchen(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const data = input as Record<string, unknown>;
  const legacyKitchen = Array.isArray(data.amenities) && data.amenities.includes("KITCHEN");
  const legacyModular = Array.isArray(data.furnishingItems) && data.furnishingItems.includes("MODULAR_KITCHEN");
  const label = typeof data.kitchenType === "string" && Object.hasOwn(propertyKitchenTypes, data.kitchenType)
    ? propertyKitchenTypes[data.kitchenType as keyof typeof propertyKitchenTypes] : undefined;
  if (!legacyKitchen && !legacyModular && !label) return data;
  return {
    ...data,
    kitchenType: label ?? (data.kitchenType === undefined ? (legacyModular ? propertyKitchenTypes.MODULAR : propertyKitchenTypes.AVAILABLE) : data.kitchenType),
    ...(legacyKitchen && Array.isArray(data.amenities) ? {amenities: data.amenities.filter((value) => value !== "KITCHEN")} : {}),
    ...(legacyModular && Array.isArray(data.furnishingItems) ? {furnishingItems: data.furnishingItems.filter((value) => value !== "MODULAR_KITCHEN")} : {}),
  };
}

export const propertyContentFields = {
  projectOrSociety: z.string().trim().min(2).max(120).optional(),
  floorNumber: z.number().int().min(0).max(250).optional(),
  totalFloors: z.number().int().min(1).max(250).optional(),
  facing: z.enum(["NORTH","SOUTH","EAST","WEST","NORTH_EAST","NORTH_WEST","SOUTH_EAST","SOUTH_WEST"]).optional(),
  kitchenType: z.string().trim().min(2).max(80).nullish().transform((value) => value ?? undefined),
  highlights: textItems(propertyDetailLimits.highlights, propertyDetailLimits.highlightLength),
  amenities: z.array(z.string().trim().min(1).max(100)).max(150).transform(values=>[...new Set(values)]).optional(),
  customAmenities: textItems(propertyDetailLimits.customAmenities, propertyDetailLimits.customAmenityLength),
  aboutPropertyHtml: z.string().max(20_000, "Keep About property under 20,000 characters.").transform(sanitizePropertyHtml).optional(),
  halls: z.number().int().min(0).max(100).optional(),
  balconies: z.number().int().min(0).max(100).optional(),
  furnishingItems: catalogSelections(propertyFurnishingItems),
  instantDeliveryAvailable: z.boolean().optional(),
  instantDeliveryApps: catalogSelections(instantDeliveryProviders),
  instantDeliveryOther: z.string().trim().min(2, "Enter the other app name.").max(80).optional(),
};
