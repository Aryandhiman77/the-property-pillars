import {BriefcaseBusiness, Building2, HardHat, Landmark, Package, Wrench} from "lucide-react";
import {publicTaskHref} from "./public-tasks";

export const marketplaceArtwork = {
  hero: "/images/daylight/marketplace-residence.webp",
  interior: "/images/daylight/architecture-hero.webp",
  banner: (section: string) => `/images/daylight/banners/${section}.webp`,
};

export const marketplaceDestinations = [
  {city: "Mumbai", country: "IN"}, {city: "London", country: "GB"},
  {city: "Dubai", country: "AE"}, {city: "Singapore", country: "SG"},
];

export const pillars = [
  {route: "properties", icon: Building2, titleKey: "propertyTitle", descriptionKey: "propertyDescription", actionKey: "propertyAction"},
  {route: "materials", icon: Package, titleKey: "materialsTitle", descriptionKey: "materialsDescription", actionKey: "materialsAction"},
  {route: "finance-services", icon: Landmark, titleKey: "financeTitle", descriptionKey: "financeDescription", actionKey: "financeAction"},
  {route: "professionals", icon: HardHat, titleKey: "expertsTitle", descriptionKey: "expertsDescription", actionKey: "expertsAction"},
  {route: "jobs", icon: BriefcaseBusiness, titleKey: "jobsTitle", descriptionKey: "jobsDescription", actionKey: "jobsAction"},
] as const;

export const directories = {
  properties: {title: "Find a property", hint: "Explore listed homes, commercial spaces and land.", icon: Building2},
  dealers: {title: "Property dealers", hint: "Browse published dealer profiles and their listings.", icon: Building2},
  materials: {title: "Construction materials", hint: "Explore local suppliers and find materials for your next project.", icon: Package},
  professionals: {title: "Find a professional", hint: "Browse architects, contractors, property lawyers and other local experts.", icon: HardHat},
  jobs: {title: "Real estate jobs", hint: "Find opportunities in property, design and construction.", icon: BriefcaseBusiness},
  workers: {title: "Find skilled workers", hint: "Explore local trades and check availability for your site.", icon: Wrench},
  projects: {title: "Builder projects", hint: "See published builder projects and location details.", icon: Building2},
} as const;

export type DirectoryKey = keyof typeof directories;

export function isDirectory(value: string): value is DirectoryKey {
  return Object.hasOwn(directories, value);
}
export function propertyListingHref(locale: string) {
  return publicTaskHref(locale, "post-property");
}
