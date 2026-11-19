import type {MetadataRoute} from "next";
import {discoveryMarkets} from "@/config/discovery";
import {locales} from "@/i18n/config";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://thepropertypillar.com"
).replace(/\/+$/, "");

const publicDirectoryPaths = [
  "",
  "/properties",
  "/dealers",
  "/materials",
  "/finance-services",
  "/professionals",
  "/jobs",
  "/workers",
  "/projects"
];

const intentPaths = (["buy", "rent"] as const).flatMap((intent) =>
  discoveryMarkets.flatMap((market) => [
    `/${intent}/${market.slug}`,
    ...market.localities.map(
      (locality) => `/${intent}/${market.slug}/${locality.slug}`
    )
  ])
);

const publicPaths = [...publicDirectoryPaths, ...intentPaths];

function languageAlternates(path: string) {
  return Object.fromEntries(
    locales.map((locale) => [locale, `${siteUrl}/${locale}${path}`])
  );
}

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.flatMap((path) =>
    locales.map((locale) => ({
      url: `${siteUrl}/${locale}${path}`,
      changeFrequency: path === "" ? "weekly" as const : "daily" as const,
      priority: path === "" ? 1 : path.startsWith("/buy/") || path.startsWith("/rent/") ? 0.8 : 0.7,
      alternates: {languages: languageAlternates(path)}
    }))
  );
}
