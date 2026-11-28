import Link from "next/link";
import Image from "next/image";
import {ArrowRight, ArrowUpRight} from "lucide-react";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {pillars} from "@/config/marketplace";
import {FeaturedProperties, HomeProperties} from "@/features/marketplace/directory";
import {loanRangeLabels} from "@/features/marketplace/loan-schedule";
import {LoanCalculator} from "@/features/marketplace/loan-calculator";
import {MarketSearch} from "@/features/home/market-search";
import {BuildingMaterials} from "@/features/home/building-materials";
import {HomeMain} from "@/features/home/home-main";
import {PropertyListingBanner} from "@/features/home/property-listing-banner";
import {HeroCarousel} from "@/features/home/hero-carousel";
import {CitySearchLinks, ExplorePropertyServices, TopPropertyCities} from "@/features/home/property-home";
import {RecommendedProperties} from "@/features/home/recommended-properties";
import {FeaturedAccounts} from "@/features/marketplace/property-resources";
import {BrowseByBudget, TopBuilders, PropertyCategories, TopHomeArticles} from "@/features/home/home-discovery-sections";
import {isAppLocale} from "@/i18n/config";

export default async function HomePage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const [t, pillarText] = await Promise.all([getTranslations("Site"), getTranslations("Pillars")]);
  const prefix = "/" + locale;
  return (
      <HomeMain>
        <HeroCarousel fallback={<><h1 id="market-hero-title" data-motion="enter">{locale === "en" ? <>Find your<br /><em>next place.</em></> : t("homeTitle")}</h1>
          <p className="market-lead" data-motion="enter">{t("homeDescription")}</p></>} />
        <div className="market-width market-search-area" data-motion="enter">
          <MarketSearch locale={locale}>
          <CitySearchLinks locale={locale} label={t("cities")}/>
          </MarketSearch>
        </div>
        <FeaturedProperties locale={locale} />
        <RecommendedProperties locale={locale} homepage />
        <HomeProperties locale={locale} />
        <PropertyCategories locale={locale} />
        <FeaturedAccounts locale={locale} />
        <TopBuilders locale={locale} />
        <BrowseByBudget locale={locale} />
        <ExplorePropertyServices locale={locale} />
        <BuildingMaterials locale={locale} />
        <TopPropertyCities locale={locale} />
        <section className="market-explore market-architecture-backdrop" aria-labelledby="market-pillars">
          <div className="market-width">
            <div className="market-section-heading" data-reveal-on-scroll>
              <h2 id="market-pillars">{t("allMarketplace")}</h2>
            </div>
            <div className="market-pillar-grid">
              {pillars.map(({route, titleKey, descriptionKey, actionKey}) => (
                <Link className="market-pillar" data-pillar={route} data-reveal-on-scroll key={route} href={prefix + "/" + route}>
                  <span className="market-pillar-media"><Image fill alt="" src={`/images/marketplace-cards/${route}.webp`}
                    sizes="(max-width: 450px) 92vw, (max-width: 760px) 46vw, (max-width: 1250px) 29vw, 370px" /></span>
                  <div className="market-pillar-copy">
                    <h3>{pillarText(titleKey)}</h3>
                    <p>{pillarText(descriptionKey)}</p>
                    <span className="market-pillar-action">{pillarText(actionKey)} <ArrowRight size={15} aria-hidden="true" /></span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
        <section className="market-width market-finance market-architecture-backdrop" aria-labelledby="home-loan-calculator" data-reveal-on-scroll>
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
        <PropertyListingBanner locale={locale} />
      </HomeMain>
  );
}
