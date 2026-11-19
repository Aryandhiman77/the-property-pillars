import Link from "next/link";
import {ChevronDown, Globe2, Plus} from "lucide-react";
import {marketplaceArtwork, marketplaceDestinations, propertyListingHref} from "@/config/marketplace";
import {publicTaskHref} from "@/config/public-tasks";
import {MarketplaceAccountLink} from "@/features/auth/marketplace-session";
import {SiteLocationLabel} from "@/features/location/site-location";
import {BrandLogo} from "./brand-logo";
import {MarketplaceNavigation, type MarketplaceMenu} from "./marketplace-navigation";
import {localeNames, locales, type AppLocale} from "@/i18n/config";

export function MarketplaceHeader({locale, labels, currentPath = ""}: {
  locale: AppLocale;
  labels: {properties: string; materials: string; services: string; jobs: string; dashboard: string; language: string};
  currentPath?: string;
}) {
  const prefix = `/${locale}`;
  const propertyMenu = (label: string, intent: "SALE" | "RENT"): MarketplaceMenu => {
    const href = `${prefix}/properties?intent=${intent}`;
    return {
      label,
      feature: intent === "SALE"
        ? {title: "Find a home to buy", image: marketplaceArtwork.banner("properties"), href, linkLabel: "Browse homes for sale"}
        : {title: "Find your next rental", image: marketplaceArtwork.interior, href, linkLabel: "Browse homes for rent"},
      groups: [
        {label: "Property types", links: [
          {label: "Apartments", href: `${href}&type=APARTMENT`},
          {label: "Independent houses", href: `${href}&type=INDEPENDENT_HOUSE`},
          {label: "Villas", href: `${href}&type=VILLA`},
          {label: "Commercial spaces", href: `${href}&category=COMMERCIAL`},
          {label: "Plots and land", href: `${href}&category=PLOT_LAND`},
        ]},
        {label: "Explore by city", links: marketplaceDestinations.map(({city, country}) => ({
          label: city, href: `${href}&country=${country}&city=${encodeURIComponent(city)}`,
        }))},
      ],
    };
  };
  const menus: MarketplaceMenu[] = [
    propertyMenu("Buy", "SALE"), propertyMenu("Rent", "RENT"),
    {
      label: labels.services,
      feature: {title: "Find help with your project", image: marketplaceArtwork.banner("professionals"), href: `${prefix}/professionals`, linkLabel: "Meet local professionals"},
      groups: [
        {label: "Find people", links: [
          {label: "Property dealers", href: `${prefix}/dealers`, detail: "Browse agencies and local property specialists"},
          {label: "Property professionals", href: `${prefix}/professionals`, detail: "Find architects, contractors and consultants"},
          {label: "Skilled workers", href: `${prefix}/workers`, detail: "Connect with local tradespeople"},
        ]},
        {label: "Marketplace", links: [
          {label: labels.materials, href: `${prefix}/materials`, detail: "Find construction supplies"},
          {label: labels.jobs, href: `${prefix}/jobs`, detail: "Browse open roles in property and construction"},
        ]},
      ],
    },
    {
      label: "Tools",
      feature: {title: "Plan your monthly payments", image: marketplaceArtwork.banner("finance-services"), href: `${prefix}/finance-services`, linkLabel: "Open the loan calculator"},
      groups: [
        {label: "Finance", links: [
          {label: "Home loan calculator", href: `${prefix}/finance-services`, detail: "Estimate repayments in your currency"},
          {label: "Submit a loan enquiry", href: publicTaskHref(locale, "finance-services/apply")},
        ]},
        {label: "Project planning", links: [
          {label: "Builder projects", href: `${prefix}/projects`, detail: "Explore new developments"},
          {label: "Construction materials", href: `${prefix}/materials`, detail: "Browse suppliers and product specifications"},
        ]},
      ],
    },
  ];
  return (
    <header className="market-header">
      <div className="market-width market-nav">
        <div className="market-brand-location">
          <Link className="market-brand" href={prefix}><BrandLogo /></Link>
          <SiteLocationLabel locale={locale} />
        </div>
        <MarketplaceNavigation menus={menus} />
        <div className="market-nav-actions">
          <details className="market-popover market-language" name="marketplace-header-menus">
            <summary aria-label={`${labels.language}, ${locale.toUpperCase()}`}><Globe2 size={17} aria-hidden="true" />{locale.toUpperCase()}<ChevronDown size={12} aria-hidden="true" /></summary>
            <div className="market-popover-menu">
              {locales.map((option) => (
                <Link key={option} lang={option} href={"/" + option + (currentPath ? "/" + currentPath : "")} aria-current={option === locale ? "true" : undefined}>
                  {localeNames[option]}
                </Link>
              ))}
            </div>
          </details>
          <Link className="market-button market-post-link" href={propertyListingHref(locale)}><Plus size={17} aria-hidden="true" />List a property</Link>
          <MarketplaceAccountLink locale={locale} label={labels.dashboard} header />
        </div>
      </div>
    </header>
  );
}
