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
  properties: {title: "findProperty", hint: "propertyDescription", icon: Building2},
  dealers: {title: "dealers", hint: "dealersDescription", icon: Building2},
  materials: {title: "constructionMaterials", hint: "materialsDescription", icon: Package},
  professionals: {title: "findProfessional", hint: "professionalsDescription", icon: HardHat},
  jobs: {title: "realEstateJobs", hint: "jobsDescription", icon: BriefcaseBusiness},
  workers: {title: "findWorkers", hint: "workersDescription", icon: Wrench},
  projects: {title: "projects", hint: "projectsDescription", icon: Building2},
} as const;

export type DirectoryKey = keyof typeof directories;

export function isDirectory(value: string): value is DirectoryKey {
  return Object.hasOwn(directories, value);
}
export function propertyListingHref(locale: string) {
  return publicTaskHref(locale, "post-property");
}
