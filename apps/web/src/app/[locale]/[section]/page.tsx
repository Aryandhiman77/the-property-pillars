import {ProjectsDirectory} from "@/features/projects/public-pages";
import {Landmark} from "lucide-react";
import Link from "next/link";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {directories, isDirectory, marketplaceArtwork} from "@/config/marketplace";
import {directoryTasks, isPublicTask, publicTaskHref, publicTasks} from "@/config/public-tasks";
import {countryName} from "@/config/listing-geography";
import {MarketplaceDirectory} from "@/features/marketplace/directory";
import {readPropertySearch} from "@/features/home/property-search-params";
import {loanRangeLabels} from "@/features/marketplace/loan-schedule";
import {LoanCalculator} from "@/features/marketplace/loan-calculator";
import {LoanEligibility} from "@/features/marketplace/loan-eligibility";
import {PublicTask} from "@/features/marketplace/public-task";
import {HomeLoanReading} from "@/features/marketplace/home-loan-reading";
import financeStyles from "@/features/marketplace/home-loan-guide.module.css";
import {MarketplaceBreadcrumbs, MarketplaceHeading, MarketplaceShell} from "@/features/marketplace/marketplace-shell";
import {PublicTaskPage, type TaskSearchParams} from "@/features/marketplace/public-task-page";
import {isAppLocale} from "@/i18n/config";

export default async function MarketplacePage({params, searchParams}: {
  params: Promise<{locale: string; section: string}>;
  searchParams: Promise<TaskSearchParams>;
}) {
  const {locale, section} = await params;
  const query = await searchParams;
  const {city, intent, country, category, type, q} = query;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  if(section==="projects") return <MarketplaceShell locale={locale}><ProjectsDirectory locale={locale} query={query}/></MarketplaceShell>;
  if (isPublicTask(section)) return <PublicTaskPage locale={locale} path={section} query={query} />;
  if (!isDirectory(section) && section !== "finance-services") notFound();
  const financing = section === "finance-services";
  const info = financing
    ? {title: "homeLoansIndia", hint: "loanDescription", icon: Landmark}
    : directories[section];
  const t = await getTranslations("Site");
  const [primary, ...secondary] = directoryTasks[section] ?? [];
  const propertyFilters = readPropertySearch(query);
  const page = typeof query.page === "string" && /^\d{1,5}$/.test(query.page) ? Math.max(1, Math.min(10_000, Number(query.page))) : 1;
  const sort = typeof query.sort === "string" && ["match", "newest", "price-low", "price-high","area-low","area-high"].includes(query.sort) ? query.sort : "match";
  const action = {label: t(publicTasks[primary].title), href: publicTaskHref(locale, primary)};
  return (
    <MarketplaceShell locale={locale}>
      <MarketplaceBreadcrumbs locale={locale} current={t(info.title)} />
      {section !== "properties" && <MarketplaceHeading icon={info.icon} title={t(info.title)} description={t(info.hint)}
        action={financing ? {label: t("checkLoanEligibility"), href: "#eligibility"} : action}
        image={financing ? "/images/banners/home-loan-house.webp" : marketplaceArtwork.banner(section)} />}
      {section !== "properties" && (secondary.length > 0 || section === "dealers") && <nav className="market-task-links" aria-label="Start a marketplace task">
        {secondary.map((path) => <Link key={path} className="market-text-link" href={publicTaskHref(locale, path)}>{t(publicTasks[path].title)}</Link>)}
        {section === "jobs" && <Link className="market-text-link" href={`/${locale}/workers`}>{t("findWorkers")}</Link>}
        {section === "dealers" && <Link className="market-text-link" href={`/${locale}/properties?postedBy=DEALER`}>{t("viewDealerListings")}</Link>}
      </nav>}
      {financing ? <>
        <nav className={financeStyles.jump} aria-label="Home loan sections">
          <Link href="#emi-calculator">{t("loanCalculator")}</Link><Link href="#bank-offers">Bank offers</Link>
          <Link href="#eligibility">{t("checkLoanEligibility")}</Link><Link href="#loan-faqs">FAQs</Link><Link href="#loan-articles">Articles</Link>
          <Link href="#loan-enquiry">{action.label}</Link>
        </nav>
        <LoanCalculator locale={locale} amount={typeof query.amount === "string" ? query.amount : undefined}
          initialRange={loanRangeLabels(locale, typeof query.currency === "string" ? query.currency : undefined)} />
        <LoanEligibility locale={locale} />
        <section id="loan-enquiry" className={financeStyles.panel} aria-labelledby="public-task-title">
          <PublicTask locale={locale} path="finance-services/apply" project={false} embedded
            initial={{data: {loanType: "HOME_LOAN", currency: "INR"}}} />
        </section>
        <HomeLoanReading locale={locale} />
      </> : (
        <MarketplaceDirectory key={JSON.stringify([section, city, intent, country, category, type, q, propertyFilters, page, sort])} kind={section} locale={locale} propertyFilters={propertyFilters} initialPage={page} initialSort={sort}
          initialCity={typeof city === "string" ? city.slice(0, 120) : ""} initialIntent={intent === "SALE" || intent === "RENT" || intent==="LEASE" ? intent : ""}
          initialKeyword={typeof q === "string" ? q.slice(0, 120) : ""}
          initialCountry={typeof country === "string" && countryName(country.toUpperCase()) ? country.toUpperCase() : ""}
          initialCategory={typeof category === "string" ? category.slice(0, 100) : ""} initialPropertyType={typeof type === "string" ? type.slice(0, 80) : ""} />
      )}
    </MarketplaceShell>
  );
}
