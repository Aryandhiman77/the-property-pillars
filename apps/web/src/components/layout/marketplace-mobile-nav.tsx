"use client";

import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import {usePathname} from "next/navigation";
import Link from "next/link";
import {useTranslations} from "next-intl";
import {Bell, House, LayoutDashboard, LogIn, Plus, Search} from "lucide-react";
import {useMarketplaceSession} from "@/features/auth/marketplace-session";
import {loginHref, openMarketplaceLogin} from "@/features/auth/login-return";
import {propertyListingHref} from "@/config/marketplace";

export function MarketplaceMobileNav({locale}: {locale: string}) {
  const t = useTranslations("Site");
  const pathname = usePathname();
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
    <BottomNavigation component="nav" showLabels value={pathname} aria-label={t("quickLinks")} className={session ? "market-mobile-dock" : "market-mobile-dock market-mobile-guest"}>
      {items.map(({label, href, icon: Icon}) => (
        <BottomNavigationAction component={Link} key={href} href={href} value={href} label={label} icon={<Icon aria-hidden="true" size={19} />} aria-current={pathname === href ? "page" : undefined} onClick={href === signIn ? openMarketplaceLogin : undefined} />
      ))}
    </BottomNavigation>
  );
}
