import Link from "next/link";
import Image from "next/image";
import {ArrowRight, ArrowUpRight, MapPin} from "lucide-react";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {MarketplaceHeader} from "@/components/layout/marketplace-header";
import {MarketplaceFooter} from "@/components/layout/marketplace-footer";
import {MarketplaceMobileNav} from "@/components/layout/marketplace-mobile-nav";
import {marketplaceArtwork, marketplaceDestinations, pillars} from "@/config/marketplace";
import {FeaturedProperties, HomeProperties} from "@/features/marketplace/directory";
import {loanRangeLabels} from "@/features/marketplace/loan-schedule";
import {LoanCalculator} from "@/features/marketplace/loan-calculator";
import {MarketSearch} from "@/features/home/market-search";
import {HomeMain} from "@/features/home/home-main";
import {PropertyListingBanner} from "@/features/home/property-listing-banner";
import {HeroCarousel} from "@/features/home/hero-carousel";
import {MarketplaceSessionProvider} from "@/features/auth/marketplace-session";
import {PropertyShortlistProvider} from "@/features/marketplace/property-shortlist";
import {ExplorePropertyServices, TopPropertyCities} from "@/features/home/property-home";
import {RecommendedProperties} from "@/features/home/recommended-properties";
import {BrowseByBudget, FeaturedDealers, PropertyCategories, TopHomeArticles} from "@/features/home/home-discovery-sections";
import {isAppLocale} from "@/i18n/config";
import "@/features/home/marketplace.css";

export default async function HomePage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const [t, pillarText] = await Promise.all([getTranslations("Site"), getTranslations("Pillars")]);
  const prefix = "/" + locale;
  return (
    <MarketplaceSessionProvider><PropertyShortlistProvider locale={locale}><div className="market">
      <MarketplaceHeader locale={locale} homeSearch />
      <HomeMain>
        <HeroCarousel fallback={<><h1 id="market-hero-title" data-motion="enter">{locale === "en" ? <>Find your<br /><em>next place.</em></> : t("homeTitle")}</h1>
          <p className="market-lead" data-motion="enter">{t("homeDescription")}</p></>} />
        <div className="market-width market-search-area" data-motion="enter">
          <MarketSearch locale={locale}>
          <div className="market-cities">
            <span><MapPin size={15} aria-hidden="true" />{t("cities")}</span>
            {marketplaceDestinations.map(({city, country}) => (
              <Link key={city} href={`${prefix}/properties?country=${country}&city=${encodeURIComponent(city)}`}>{city}</Link>
            ))}
          </div>
          </MarketSearch>
        </div>
        <FeaturedProperties locale={locale} />
        <RecommendedProperties locale={locale} homepage />
        <HomeProperties locale={locale} />
        <PropertyCategories locale={locale} />
        <FeaturedDealers locale={locale} />
        <BrowseByBudget locale={locale} />
        <ExplorePropertyServices locale={locale} />
        <TopPropertyCities locale={locale} />
        <section className="market-explore" aria-labelledby="market-pillars">
          <div className="market-width">
            <div className="market-section-heading" data-reveal-on-scroll>
              <h2 id="market-pillars">{t("allMarketplace")}</h2>
            </div>
            <div className="market-pillar-grid">
              {pillars.map(({route, titleKey, descriptionKey, actionKey}) => (
                <Link className={route === "properties" ? "market-pillar market-pillar-feature" : "market-pillar"} data-reveal-on-scroll key={route} href={prefix + "/" + route}>
                  <span className="market-pillar-media"><Image fill alt="" src={marketplaceArtwork.banner(route)}
                    sizes={route === "properties" ? "(max-width: 760px) 94vw, (max-width: 1250px) 44vw, 520px" : "(max-width: 350px) 92vw, (max-width: 760px) 46vw, (max-width: 1250px) 25vw, 300px"} /></span>
                  <div className="market-pillar-copy">
                    <h3>{pillarText(titleKey)}</h3>
                    {route === "properties" && <p>{pillarText(descriptionKey)}</p>}
                    <span className="market-pillar-action">{pillarText(actionKey)} <ArrowRight size={15} aria-hidden="true" /></span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
        <PropertyListingBanner locale={locale} />
        <section className="market-width market-finance" aria-labelledby="home-loan-calculator" data-reveal-on-scroll>
          <div className="market-section-heading market-finance-heading">
            <div>
              <h2 id="home-loan-calculator">{t("loanCalculator")}</h2>
              <p>{t("loanDescription")}</p>
            </div>
            <Link className="market-finance-link" href={prefix + "/finance-services"}>
              {t("loanCalculator")} <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <LoanCalculator locale={locale} initialRange={loanRangeLabels(locale)} headingAs="h3" homepage />
        </section>
        <TopHomeArticles locale={locale} />
      </HomeMain>
      <MarketplaceFooter locale={locale} />
      <MarketplaceMobileNav locale={locale} />
    </div></PropertyShortlistProvider></MarketplaceSessionProvider>
  );
}
