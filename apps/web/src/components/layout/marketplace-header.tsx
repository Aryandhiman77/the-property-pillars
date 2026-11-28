"use client";

import AppBar from "@mui/material/AppBar";
import {FreeBadge} from "@/components/ui/free-badge";
import Link from "next/link";
import {Plus, Search, X} from "lucide-react";
import {useTranslations} from "next-intl";
import {usePathname} from "next/navigation";
import {useEffect, useRef, useState} from "react";
import {propertyListingHref} from "@/config/marketplace";
import {MarketplaceAccountLink} from "@/features/auth/marketplace-session";
import {SiteLocationLabel} from "@/features/location/site-location";
import {SectionNavigation} from "./section-navigation";
import {BrandLogo} from "./brand-logo";
import {MarketplaceNavigation} from "./marketplace-navigation";
import {LocaleMenu} from "./locale-menu";
import {ManualUatLink} from "./manual-uat-link";
import {MarketSearch} from "@/features/home/market-search";
import {ArticleHeader} from "@/features/articles/article-header";
import type {AppLocale} from "@/i18n/config";

const sectionLinks = [
  ["properties?intent=SALE", "homesForSale"],
  ["properties?intent=RENT", "homesForRent"],
  ["dealers", "dealers"],
  ["professionals", "professionals"],
  ["workers", "workers"],
  ["materials", "buildingMaterials"],
  ["finance-services", "loanHeroLabel"],
  ["projects", "projects"],
] as const;

export function MarketplaceHeader({locale}: {locale: AppLocale}) {
  const t = useTranslations("Site");
  const prefix = "/" + locale;
  const pathname = usePathname();
  const home = pathname === prefix || pathname === prefix + "/";
  const [searchOpen, setSearchOpen] = useState(false);
  const searchSlot = useRef<HTMLDivElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {setSearchOpen(false);}, [pathname]);
  useEffect(() => {
    if (searchOpen) searchSlot.current?.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus();
  }, [searchOpen]);
  function closeSearch() {
    setSearchOpen(false);
    requestAnimationFrame(() => searchButton.current?.focus());
  }
  const navigation = (
      <div className={"market-width market-nav" + (home ? "" : " market-nav--with-search")} data-search-open={searchOpen || undefined}>
        <div className="market-brand-location">
          <Link className="market-brand" href={prefix}><BrandLogo /></Link>
          <SiteLocationLabel locale={locale} />
        </div>
        <div id="market-header-search" className="market-header-search" ref={searchSlot}
          onKeyDown={event => {if (event.key === "Escape" && !event.defaultPrevented && searchOpen) closeSearch();}}>
          {!home && <><MarketSearch locale={locale} compact />
            {searchOpen && <button type="button" className="market-search-close" aria-label={t("close")} onClick={closeSearch}><X size={18}/></button>}</>}
        </div>
        <div className="market-nav-center">
          <MarketplaceNavigation locale={locale} compact={!home} />
          {!home && <button type="button" className="market-search-toggle" aria-controls="market-header-search" aria-label={t("search")}
            aria-expanded={searchOpen} ref={searchButton} onClick={() => setSearchOpen(true)}><Search size={18}/></button>}
        </div>
        <div className="market-nav-actions">
          <LocaleMenu />
          <Link className="market-button market-post-link" href={propertyListingHref(locale)}><Plus size={17} aria-hidden="true" />{t("listProperty")} <FreeBadge /></Link>
          <MarketplaceAccountLink locale={locale} label={t("dashboard")} header><ManualUatLink /></MarketplaceAccountLink>
        </div>
      </div>
  );
  const sections = <SectionNavigation locale={locale} links={sectionLinks.map(([path, key]) => ({path, label: t(key)}))} />;
  return <AppBar component="header" color="inherit" elevation={0} position="sticky" className={"market-header" + (home ? " market-header-home" : "")}>
    <ArticleHeader locale={locale} readerNavigation={<MarketplaceNavigation locale={locale} compact />}>{navigation}</ArticleHeader>
    {sections}
  </AppBar>;
}
