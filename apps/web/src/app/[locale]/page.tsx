import Image from "next/image";
import Link from "next/link";
import {ArrowRight, ArrowUpRight, MapPin} from "lucide-react";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {MarketplaceHeader} from "@/components/layout/marketplace-header";
import {MarketplaceFooter} from "@/components/layout/marketplace-footer";
import {MarketplaceMobileNav} from "@/components/layout/marketplace-mobile-nav";
import {marketplaceArtwork, marketplaceDestinations, pillars, propertyListingHref} from "@/config/marketplace";
import {FeaturedProperties} from "@/features/marketplace/directory";
import {LoanCalculator} from "@/features/marketplace/loan-calculator";
import {MarketSearch} from "@/features/home/market-search";
import {MarketplaceSessionProvider} from "@/features/auth/marketplace-session";
import {isAppLocale} from "@/i18n/config";
import "@/features/home/marketplace.css";

const discover = [
  {title: "Homes for sale", description: "Browse apartments, houses and land.", path: "properties?intent=SALE", image: marketplaceArtwork.banner("properties")},
  {title: "Homes for rent", description: "Find your next rental by city or locality.", path: "properties?intent=RENT", image: marketplaceArtwork.interior},
  {title: "New developments", description: "Explore projects and learn about the builders behind them.", path: "projects", image: marketplaceArtwork.banner("projects")},
];

export default async function HomePage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const [nav, home, pillarText, footer] = await Promise.all([
    getTranslations("Navigation"), getTranslations("Home"),
    getTranslations("Pillars"), getTranslations("Footer"),
  ]);
  const prefix = "/" + locale;
  return (
    <MarketplaceSessionProvider><div className="market">
      <MarketplaceHeader locale={locale} labels={{
        properties: nav("properties"), materials: nav("materials"), services: nav("services"),
        jobs: nav("jobs"), dashboard: nav("dashboard"), language: nav("language"),
      }} />
      <main id="market-main">
        <section className="market-hero" aria-labelledby="market-hero-title">
          <div className="market-hero-visual">
            <Image className="market-hero-image" src={marketplaceArtwork.hero} alt="" fill priority sizes="100vw" />
          </div>
          <div className="market-width market-hero-content">
            <div className="market-hero-copy">
              <h1 id="market-hero-title">{locale === "en" ? <>Find your<br /><em>next place.</em></> : home("title")}</h1>
              <p className="market-lead">{locale === "en" ? "Search homes, land and commercial spaces across cities and countries." : home("description")}</p>
            </div>
          </div>
        </section>
        <div className="market-width market-search-area">
          <MarketSearch label={nav("search")} locale={locale} labels={{materials: nav("materials"), services: nav("services"), jobs: nav("jobs")}} />
          <div className="market-cities">
            <span><MapPin size={15} aria-hidden="true" /> Explore by city</span>
            {marketplaceDestinations.map(({city, country}) => (
              <Link key={city} href={`${prefix}/properties?country=${country}&city=${encodeURIComponent(city)}`}>{city}</Link>
            ))}
          </div>
        </div>
        <section className="market-width market-discover" aria-labelledby="discover-property">
          <div className="market-section-heading"><h2 id="discover-property">Explore properties</h2></div>
          <div className="market-discover-grid">
            {discover.map((item) => <Link href={`${prefix}/${item.path}`} className="market-discover-card" key={item.path}>
              <div className="market-discover-photo"><Image src={item.image} alt="" fill sizes="(max-width: 660px) 100vw, 33vw" /></div>
              <div className="market-discover-copy"><div><h3>{item.title}</h3><p>{item.description}</p></div><span className="market-card-arrow"><ArrowUpRight size={20} aria-hidden="true" /></span></div>
            </Link>)}
          </div>
        </section>
        <FeaturedProperties locale={locale} />
        <section className="market-explore" aria-labelledby="market-pillars">
          <div className="market-width">
            <div className="market-section-heading">
              <h2 id="market-pillars">{home("pillarHeading")}</h2>
            </div>
            <div className="market-pillar-grid">
              {pillars.map(({route, icon: Icon, titleKey, descriptionKey, actionKey}) => (
                <Link className="market-pillar" key={route} href={prefix + "/" + route}>
                  <span className="market-pillar-icon"><Icon size={23} strokeWidth={1.75} aria-hidden="true" /></span>
                  <h3>{pillarText(titleKey)}</h3><p>{pillarText(descriptionKey)}</p>
                  <span className="market-pillar-action">{pillarText(actionKey)} <ArrowRight size={15} aria-hidden="true" /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>
        <section className="market-width market-finance" aria-labelledby="home-loan-calculator">
          <div className="market-section-heading market-finance-heading">
            <div>
              <h2 id="home-loan-calculator">Home loan EMI calculator</h2>
              <p>See your estimated monthly payment, total interest and total repayment.</p>
            </div>
            <Link className="market-finance-link" href={prefix + "/finance-services"}>
              Open calculator page <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <LoanCalculator locale={locale} headingAs="h3" />
        </section>
        <section className="market-width market-listing" aria-labelledby="home-listing-title">
          <div className="market-listing-copy">
            <h2 id="home-listing-title">Sell or rent your property</h2>
            <p>Add your property details, upload photos, and set your asking price. Submit the listing for review when it’s ready.</p>
            <Link className="market-button" href={propertyListingHref(locale)}>Create a listing <ArrowUpRight size={17} aria-hidden="true" /></Link>
          </div>
          <div className="market-listing-photo">
            <Image src={marketplaceArtwork.banner("dealers")} alt="" fill sizes="(max-width: 760px) 100vw, 45vw" />
          </div>
        </section>
      </main>
      <MarketplaceFooter locale={locale} tagline={footer("tagline")} disclaimer={footer("disclaimer")} />
      <MarketplaceMobileNav locale={locale} labels={{home: nav("home"), search: nav("search"), post: nav("post"), alerts: nav("alerts"), dashboard: nav("dashboard")}} />
    </div></MarketplaceSessionProvider>
  );
}
