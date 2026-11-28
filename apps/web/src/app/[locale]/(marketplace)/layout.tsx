import type {ReactNode} from "react";
import {notFound} from "next/navigation";
import {setRequestLocale} from "next-intl/server";
import {isAppLocale} from "@/i18n/config";
import {MarketplaceHeader} from "@/components/layout/marketplace-header";
import {MarketplaceFooter} from "@/components/layout/marketplace-footer";
import {MarketplaceMobileNav} from "@/components/layout/marketplace-mobile-nav";
import {MarketplaceSessionProvider} from "@/features/auth/marketplace-session";
import {PropertyShortlistProvider} from "@/features/marketplace/property-shortlist";
import "@/features/home/marketplace.css";

export default async function MarketplaceLayout({children, params}: {children:ReactNode; params:Promise<{locale:string}>}) {
  const {locale} = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  return <MarketplaceSessionProvider><PropertyShortlistProvider locale={locale}>
    <div className="market">
      <MarketplaceHeader locale={locale}/>
      {children}
      <MarketplaceFooter locale={locale}/>
      <MarketplaceMobileNav locale={locale}/>
    </div>
  </PropertyShortlistProvider></MarketplaceSessionProvider>;
}
