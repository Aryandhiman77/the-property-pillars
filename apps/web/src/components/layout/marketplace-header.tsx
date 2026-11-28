import AppBar from "@mui/material/AppBar";
import Link from "next/link";
import {Plus} from "lucide-react";
import {getTranslations} from "next-intl/server";
import {propertyListingHref} from "@/config/marketplace";
import {MarketplaceAccountLink} from "@/features/auth/marketplace-session";
import {SiteLocationLabel} from "@/features/location/site-location";
import {BrandLogo} from "./brand-logo";
import {MarketplaceNavigation} from "./marketplace-navigation";
import {LocaleMenu} from "./locale-menu";
import {ManualUatLink} from "./manual-uat-link";
import {MarketSearch} from "@/features/home/market-search";
import {ArticleHeader} from "@/features/articles/article-header";
import type {AppLocale} from "@/i18n/config";

export async function MarketplaceHeader({locale, homeSearch = false, articleReader = false}: {locale: AppLocale; homeSearch?: boolean; articleReader?: boolean}) {
  const t = await getTranslations("Site");
  const prefix = `/${locale}`;
  const navigation = (
      <div className={homeSearch ? "market-width market-nav" : "market-width market-nav market-nav--with-search"}>
        <div className="market-brand-location">
          <Link className="market-brand" href={prefix}><BrandLogo /></Link>
          <SiteLocationLabel locale={locale} />
        </div>
        {!homeSearch && <div id="market-header-search" className="market-header-search"><MarketSearch locale={locale} compact /></div>}
        <MarketplaceNavigation locale={locale} compact={!homeSearch} />
        <div className="market-nav-actions">
          <LocaleMenu />
          <Link className="market-button market-post-link" href={propertyListingHref(locale)}><Plus size={17} aria-hidden="true" />{t("listProperty")}</Link>
          <MarketplaceAccountLink locale={locale} label={t("dashboard")} header><ManualUatLink /></MarketplaceAccountLink>
        </div>
      </div>
  );
  return articleReader ? <ArticleHeader locale={locale} readerNavigation={<MarketplaceNavigation locale={locale} compact />}>{navigation}</ArticleHeader> :
    <AppBar component="header" color="inherit" elevation={0} position="sticky" className={homeSearch ? "market-header market-header-home" : "market-header"}>{navigation}</AppBar>;
}
