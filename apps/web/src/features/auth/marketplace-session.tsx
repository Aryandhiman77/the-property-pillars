"use client";

import {createContext, useContext, type ReactNode} from "react";
import Link from "next/link";
import {ArrowUpRight, LayoutDashboard, LogIn} from "lucide-react";
import {useSession} from "./use-session";
import {loginHref, openMarketplaceLogin} from "./login-return";
const MarketplaceSession = createContext<ReturnType<typeof useSession> | null>(null);

export function MarketplaceSessionProvider({children}: {children: ReactNode}) {
  const auth = useSession();
  return <MarketplaceSession.Provider value={auth}>{children}</MarketplaceSession.Provider>;
}

export function useMarketplaceSession() {
  return useMarketplaceAuth()?.session ?? null;
}

export function useMarketplaceAuth() {
  return useContext(MarketplaceSession);
}

export function MarketplaceAccountLink({locale, label, header}: {locale: string; label: string; header?: boolean}) {
  const session = useMarketplaceSession();
  const text = session ? label : "Sign in";
  const Icon = session ? LayoutDashboard : LogIn;
  const href = session ? `/${locale}/dashboard` : loginHref(locale);
  const signIn = session ? undefined : openMarketplaceLogin;
  return header ? (
    <Link className="market-button market-dashboard-link" href={href} onClick={signIn} aria-label={text}>
      <Icon className="market-dashboard-icon" size={18} aria-hidden="true" />
      <span>{text}</span><ArrowUpRight className="market-dashboard-arrow" size={15} aria-hidden="true" />
    </Link>
  ) : <Link href={href} onClick={signIn}>{text}</Link>;
}
