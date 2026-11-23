"use client";

import Link from "next/link";
import {useTranslations} from "next-intl";
import {Bell, House, LayoutDashboard, LogIn, Plus, Search} from "lucide-react";
import {useMarketplaceSession} from "@/features/auth/marketplace-session";
import {loginHref, openMarketplaceLogin} from "@/features/auth/login-return";
import {propertyListingHref} from "@/config/marketplace";

export function MarketplaceMobileNav({locale}: {locale: string}) {
  const t = useTranslations("Site");
  const session = useMarketplaceSession();
  const prefix = `/${locale}`;
  const signIn = loginHref(locale);
  const items = [
    {label: t("home"), href: prefix, icon: House},
    {label: t("search"), href: `${prefix}/properties`, icon: Search},
    {label: t("listProperty"), href: propertyListingHref(locale), icon: Plus},
    ...(session ? [{label: t("alerts"), href: `${prefix}/dashboard/notifications`, icon: Bell}, {label: t("dashboard"), href: `${prefix}/dashboard`, icon: LayoutDashboard}]
      : [{label: t("signIn"), href: signIn, icon: LogIn}]),
  ];
  return (
    <nav aria-label={t("quickLinks")} className={session ? "market-mobile-dock" : "market-mobile-dock market-mobile-guest"}>
      {items.map(({label, href, icon: Icon}) => (
        <Link key={label} href={href} onClick={href === signIn ? openMarketplaceLogin : undefined}><Icon aria-hidden="true" size={19} /><span>{label}</span></Link>
      ))}
    </nav>
  );
}
