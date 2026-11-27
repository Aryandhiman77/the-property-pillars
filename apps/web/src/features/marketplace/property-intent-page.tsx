import type {Metadata} from "next";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {directories, marketplaceArtwork} from "@/config/marketplace";
import {
  discoveryMarkets,
  getDiscoveryLocality,
  getDiscoveryMarket
} from "@/config/discovery";
import {locales, type AppLocale, isAppLocale} from "@/i18n/config";
import {MarketplaceDirectory} from "./directory";
import {MarketplaceBreadcrumbs, MarketplaceHeading, MarketplaceShell} from "./marketplace-shell";

export type PropertyIntent = "buy" | "rent";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://thepropertypillar.com"
).replace(/\/+$/, "");

function intentDetails(intent: PropertyIntent) {
  return intent === "buy"
    ? {title: "saleIn", value: "SALE", action: "buy"} as const
    : {title: "rentIn", value: "RENT", action: "rent"} as const;
}

function resolveLocation(city: string, locality?: string) {
  const market = getDiscoveryMarket(city);
  if (!market) notFound();

  const selectedLocality = locality
    ? getDiscoveryLocality(market, locality)
    : undefined;
  if (locality && !selectedLocality) notFound();

  return {
    market,
    locality: selectedLocality,
    displayName: selectedLocality
      ? `${selectedLocality.name}, ${market.name}`
      : market.name,
    filterName: selectedLocality?.name ?? market.name
  };
}

function localizedAlternates(path: string) {
  return Object.fromEntries(
    locales.map((locale) => [locale, `${siteUrl}/${locale}${path}`])
  );
}

export async function buildPropertyIntentMetadata({
  locale,
  intent,
  city,
  locality
}: {
  locale: string;
  intent: PropertyIntent;
  city: string;
  locality?: string;
}): Promise<Metadata> {
  if (!isAppLocale(locale)) return {};
  const t = await getTranslations({locale, namespace: "Site"});
  const location = resolveLocation(city, locality);
  const details = intentDetails(intent);
  const title = t(details.title, {place: location.displayName});
  const path = `/${intent}/${city}${locality ? `/${locality}` : ""}`;

  return {
    title,
    description: t("propertyDescription"),
    alternates: {
      canonical: `${siteUrl}/${locale}${path}`,
      languages: localizedAlternates(path)
    },
    robots: {index: true, follow: true}
  };
}

export function propertyCityStaticParams() {
  return locales.flatMap((locale) =>
    discoveryMarkets.map((market) => ({locale, city: market.slug}))
  );
}

export function propertyLocalityStaticParams() {
  return locales.flatMap((locale) =>
    discoveryMarkets.flatMap((market) =>
      market.localities.map((locality) => ({
        locale,
        city: market.slug,
        locality: locality.slug
      }))
    )
  );
}

export async function PropertyIntentPage({
  locale,
  intent,
  city,
  locality
}: {
  locale: string;
  intent: PropertyIntent;
  city: string;
  locality?: string;
}) {
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Site");

  const location = resolveLocation(city, locality);
  const details = intentDetails(intent);
  const title = t(details.title, {place: location.displayName});
  const canonicalPath = `/${locale}/${intent}/${city}${
    locality ? `/${locality}` : ""
  }`;
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: t("home"),
        item: `${siteUrl}/${locale}`
      },
      {
        "@type": "ListItem",
        position: 2,
        name: t(details.action),
        item: `${siteUrl}/${locale}/${intent}/${city}`
      },
      {
        "@type": "ListItem",
        position: 3,
        name: location.displayName,
        item: `${siteUrl}${canonicalPath}`
      }
    ]
  };

  return (
    <MarketplaceShell locale={locale as AppLocale}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumb).replaceAll("<", "\\u003c")
        }}
      />
      <MarketplaceBreadcrumbs locale={locale} parent={{title: t(directories.properties.title), href: `/${locale}/properties`}} current={location.displayName} />
      <MarketplaceHeading title={title} description={t("propertyDescription")}
        image={intent === "rent" ? marketplaceArtwork.interior : marketplaceArtwork.banner("properties")} action={{
        label: t("viewProperties"), href: `/${locale}/properties?intent=${details.value}&city=${encodeURIComponent(location.filterName)}`,
      }} />
      <MarketplaceDirectory
        kind="properties"
        locale={locale}
        initialCity={location.filterName}
        initialIntent={details.value}
      />
    </MarketplaceShell>
  );
}
