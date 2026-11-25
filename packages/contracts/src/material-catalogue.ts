export const specificationTypes = ["TEXT", "NUMBER", "DECIMAL", "BOOLEAN", "DROPDOWN", "MULTI_SELECT", "UNIT_VALUE", "RANGE"] as const;
export type SpecificationType = typeof specificationTypes[number];
export type SpecificationDefinition = {
  id: string; name: string; fieldType: SpecificationType; unit: string | null;
  categoryId: string; subcategoryId: string | null; active: boolean; required: boolean; sortOrder: number; options: string[];
};
export type SpecificationValue = string | number | boolean | string[] | {min: number; max: number};
export const materialPricingTypes = ["FIXED", "STARTING_FROM", "RANGE", "ON_REQUEST"] as const;
export const materialAvailability = ["IN_STOCK", "LIMITED_STOCK", "MADE_TO_ORDER", "ON_REQUEST", "TEMPORARILY_UNAVAILABLE", "OUT_OF_STOCK"] as const;
