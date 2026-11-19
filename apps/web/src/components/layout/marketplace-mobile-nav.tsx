"use client";

import Link from "next/link";
import {Bell, House, LayoutDashboard, LogIn, Plus, Search} from "lucide-react";
import {useMarketplaceSession} from "@/features/auth/marketplace-session";
import {loginHref, openMarketplaceLogin} from "@/features/auth/login-return";
import {propertyListingHref} from "@/config/marketplace";

export function MarketplaceMobileNav({locale, labels}: {
  locale: string;
  labels: {home: string; search: string; post: string; alerts: string; dashboard: string};
}) {
  const session = useMarketplaceSession();
  const prefix = `/${locale}`;
  const signIn = loginHref(locale);
  const items = [
    {label: labels.home, href: prefix, icon: House},
    {label: labels.search, href: `${prefix}/properties`, icon: Search},
    {label: labels.post, href: propertyListingHref(locale), icon: Plus},
    ...(session ? [{label: labels.alerts, href: `${prefix}/dashboard/notifications`, icon: Bell}, {label: labels.dashboard, href: `${prefix}/dashboard`, icon: LayoutDashboard}]
      : [{label: "Sign in", href: signIn, icon: LogIn}]),
  ];
  return (
    <nav aria-label="Quick navigation" className={session ? "market-mobile-dock" : "market-mobile-dock market-mobile-guest"}>
      {items.map(({label, href, icon: Icon}) => (
        <Link key={label} href={href} onClick={href === signIn ? openMarketplaceLogin : undefined}><Icon aria-hidden="true" size={19} /><span>{label}</span></Link>
      ))}
    </nav>
  );
}
