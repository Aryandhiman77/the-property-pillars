import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";

export type ProjectImage = {
  id?: string;
  url: string;
  classification?: string;
  caption?: string;
  alt?: string;
};
export type Configuration = {
  id: string;
  name: string;
  category: { name: string };
  type: { name: string };
  areaUnit: { code: string };
  carpetArea?: string;
  builtUpArea?: string;
  plotArea?: string;
  superBuiltUpArea?: string;
  bedrooms?: number;
  bathrooms?: number;
  available?: number | null;
  startingPrice?: string;
  maximumPrice?: string;
  currency?: string;
  fitOut?: string;
  description?: string;
  priceMode: string;
};
type Price = {
  startingPrice?: string | null;
  maximumPrice?: string | null;
  priceOnRequest?: boolean;
  priceMode?: string;
  currency?: string | null;
};
export type ProjectCard = Price & {
  id: string;
  slug: string;
  name: string;
  sponsored?: boolean;
  category?: string;
  projectType?: string;
  constructionStatus?: string;
  cityName?: string;
  localityName?: string;
  possession?: string;
  registrationNumber?: string;
  regulatoryVerified: boolean;
  media: ProjectImage[];
  configurations: Configuration[];
  builderProfile?: {
    profileId: string;
    brandName?: string;
    legalName?: string;
    profile: {
      verification: string;
      user: { fullName: string; profileLogoUrl?: string };
    };
  };
};
export type ProjectDetail = ProjectCard & {
  contactMethod?: string;
  shortDescription?: string;
  aboutHtml?: string;
  highlights: string[];
  projectArea?: string;
  areaUnit?: { code: string };
  declaredUnits?: number;
  launch?: string;
  authority?: string;
  verificationUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
  precision: string;
  phases: { id: string; name: string; status?: string; possession?: string }[];
  towers: { id: string; name: string; floors?: number }[];
  amenities: { master: { name: string }; status: string }[];
  specifications: { id: string; name: string; description: string }[];
  places: {
    id: string;
    name: string;
    category: string;
    distance?: string;
    unit?: string;
    travelMinutes?: number;
  }[];
  paymentPlans: {
    id: string;
    name: string;
    description?: string;
    mode: string;
    currency?: string;
    milestones: {
      id: string;
      name: string;
      amount: string;
      trigger?: string;
      timing?: string;
    }[];
  }[];
  updates: {
    id: string;
    title: string;
    date: string;
    description: string;
    percentage?: string;
    mediaUrls: string[];
    videoUrl?: string;
  }[];
  videos: {
    id: string;
    title: string;
    kind: string;
    url: string;
    caption?: string;
  }[];
  listings: { id: string; title: string; price?: string; currency?: string }[];
};
export function price(p: Price, locale: string) {
  if (
    p.priceOnRequest ||
    p.priceMode === "ON_REQUEST" ||
    p.startingPrice == null ||
    !p.currency
  )
    return "Price on request";
  const format = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: p.currency,
    maximumFractionDigits: 0,
  });
  return (
    format.format(Number(p.startingPrice)) +
    (p.maximumPrice != null &&
    Number(p.maximumPrice) !== Number(p.startingPrice)
      ? " – " + format.format(Number(p.maximumPrice))
      : "")
  );
}
export const builderName = (p: ProjectCard) =>
  p.builderProfile?.brandName ||
  p.builderProfile?.legalName ||
  p.builderProfile?.profile.user.fullName;
export const human = (value?: string) =>
  value?.replaceAll("_", " ").toLowerCase();
export const projectFetch = cache(async (path: string) => {
  const authority = (await headers()).get("host") ?? "",
    host = authority.split(":")[0],
    jar = await cookies();
  const uat =
    process.env.NODE_ENV === "development" &&
    ["127.0.0.1", "localhost"].includes(host ?? "") &&
    jar.get("tpp_uat_mode")?.value === "1";
  const root = uat
    ? "http://127.0.0.1:4021"
    : (process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000");
  const res = await fetch(new URL("/api/v1/" + path, root), {
    cache: "no-store",
    headers: uat ? { "X-Forwarded-Host": authority } : undefined,
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 404) notFound();
  if (res.status === 422) return { error: (await res.json()).error.message };
  if (!res.ok) throw Error("Project information could not be loaded.");
  return (await res.json()).data;
});
export const detail = async (slug: string): Promise<ProjectDetail> =>
  projectFetch("public/new-projects/" + encodeURIComponent(slug));
