import {materialCategories, AREA_UNITS} from "@the-property-pillar/contracts";
import {propertyAmenityFields} from "@/config/property-amenities";

export const marketplaceSearchScopes = {
  properties: {label: "Properties", route: "properties", fixed: undefined},
  dealers: {label: "Property Dealers", route: "dealers", fixed: undefined},
  projects: {label: "Builder Projects", route: "projects", fixed: undefined},
  materials: {label: "Construction Materials", route: "materials", fixed: undefined},
  finance: {label: "Home Loans & EMI", route: "finance-services", fixed: undefined},
  legal: {label: "Legal & Vastu Services", route: "professionals", fixed: {scope: "legal-vastu"}},
  professionals: {label: "Construction, Architecture & Interiors", route: "professionals", fixed: {scope: "building-services"}},
  jobs: {label: "Real Estate Jobs", route: "jobs", fixed: undefined},
  workers: {label: "Skilled Workers", route: "workers", fixed: undefined},
} as const;
export type MarketplaceSearchScope = keyof typeof marketplaceSearchScopes;
type Option = {value: string; label: string};
export type DirectoryFilter = {key: string; label: string; options: readonly Option[]};
export const displayOption = (value: string): string => value.includes("_") || /^[A-Z]+$/.test(value)
  ? value.toLowerCase().replaceAll("_", " ").replace(/\b[a-z]/g, (letter) => letter.toUpperCase()) : value;
const values = (entries: readonly string[]): Option[] => entries.map((value) => ({value, label: displayOption(value)}));
export function directoryFilterOptions(scope: MarketplaceSearchScope, facets: Record<string, string[]>): DirectoryFilter[] {
  const facet = (key: string, label: string) => ({key, label, options: values(facets[key] ?? [])});
  const experience = {key: "experience", label: "Minimum experience", options: ["1", "3", "5", "10"].map((value) => ({value, label: value + "+ years"}))};
  const config: Partial<Record<MarketplaceSearchScope, DirectoryFilter[]>> = {
    properties: [
      ...propertyAmenityFields,
      {key: "unit", label: "Area unit", options: AREA_UNITS.map((value) => ({value, label: value}))},
      {key: "rera", label: "RERA", options: [{value: "1", label: "RERA number available"}]},
    ],
    projects: [facet("projectType", "Project type")],
    materials: [{key: "category", label: "Material category", options: materialCategories}, facet("brand", "Brand"), facet("availability", "Availability")],
    legal: [facet("serviceType", "Legal & Vastu service"), experience],
    professionals: [facet("serviceType", "Professional service"), experience],
    jobs: [
      {key: "employment", label: "Employment type", options: values(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"])},
      {key: "workMode", label: "Work mode", options: values(["ON_SITE", "HYBRID", "REMOTE"])},
      {key: "acceptingApplications", label: "Applications", options: [{value: "1", label: "Accepting applications"}]},
    ],
    workers: [facet("trade", "Trade"), {key: "availability", label: "Availability", options: values(["AVAILABLE", "BUSY"])}],
  };
  return (config[scope] ?? []).filter(({options}) => options.length > 0);
}
