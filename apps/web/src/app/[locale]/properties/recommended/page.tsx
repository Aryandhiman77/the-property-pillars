import {setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {isAppLocale} from "@/i18n/config";
import {MarketplaceShell} from "@/features/marketplace/marketplace-shell";
import {RecommendedProperties} from "@/features/home/recommended-properties";

export const metadata = {title: "Recommended properties", robots: {index: false, follow: true}};

export default async function RecommendedPage({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{page?: string}>;
}) {
  const [{locale}, query] = await Promise.all([params, searchParams]);
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const page = /^\d+$/.test(query.page ?? "") ? Math.min(1000, Math.max(1, Number(query.page))) : 1;
  return <MarketplaceShell locale={locale}><RecommendedProperties locale={locale} page={page} /></MarketplaceShell>;
}
