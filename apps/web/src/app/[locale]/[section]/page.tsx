import {Landmark} from "lucide-react";
import Link from "next/link";
import {setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {directories, isDirectory, marketplaceArtwork} from "@/config/marketplace";
import {directoryTasks, isPublicTask, publicTaskHref, publicTasks} from "@/config/public-tasks";
import {countryName} from "@/config/listing-geography";
import {MarketplaceDirectory} from "@/features/marketplace/directory";
import {LoanCalculator} from "@/features/marketplace/loan-calculator";
import {MarketplaceBreadcrumbs, MarketplaceHeading, MarketplaceShell} from "@/features/marketplace/marketplace-shell";
import {PublicTaskPage, type TaskSearchParams} from "@/features/marketplace/public-task-page";
import {isAppLocale} from "@/i18n/config";

export default async function MarketplacePage({params, searchParams}: {
  params: Promise<{locale: string; section: string}>;
  searchParams: Promise<TaskSearchParams>;
}) {
  const {locale, section} = await params;
  const query = await searchParams;
  const {city, intent, country, category, type} = query;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  if (isPublicTask(section)) return <PublicTaskPage locale={locale} path={section} query={query} />;
  if (!isDirectory(section) && section !== "finance-services") notFound();
  const financing = section === "finance-services";
  const info = financing
    ? {title: "Plan your home loan", hint: "Estimate your monthly payment or submit a loan enquiry.", icon: Landmark}
    : directories[section];
  const [primary, ...secondary] = directoryTasks[section] ?? [];
  const action = {label: publicTasks[primary].title, href: publicTaskHref(locale, primary)};
  return (
    <MarketplaceShell locale={locale} currentPath={section}>
      <MarketplaceBreadcrumbs locale={locale} current={info.title} />
      <MarketplaceHeading icon={info.icon} title={info.title} description={info.hint} action={action} image={marketplaceArtwork.banner(section)} />
      {secondary.length > 0 && <nav className="market-task-links" aria-label="Start a marketplace task">
        {secondary.map((path) => <Link key={path} className="market-text-link" href={publicTaskHref(locale, path)}>{publicTasks[path].title}</Link>)}
        {section === "jobs" && <Link className="market-text-link" href={`/${locale}/workers`}>Find skilled workers</Link>}
      </nav>}
      {financing ? <LoanCalculator locale={locale} /> : (
        <MarketplaceDirectory key={[section, city, intent, country, category, type].join("|")} kind={section} locale={locale}
          initialCity={typeof city === "string" ? city.slice(0, 80) : ""} initialIntent={intent === "SALE" || intent === "RENT" ? intent : ""}
          initialCountry={typeof country === "string" && countryName(country.toUpperCase()) ? country.toUpperCase() : ""}
          initialCategory={typeof category === "string" ? category.slice(0, 100) : ""} initialPropertyType={typeof type === "string" ? type.slice(0, 80) : ""} />
      )}
    </MarketplaceShell>
  );
}
