"use client";

import {createContext, useContext, useRef, useState, type ReactNode} from "react";
import Link from "next/link";
import {useTranslations} from "next-intl";
import {ArrowUpRight, LayoutDashboard, LogIn, LogOut, UserRound} from "lucide-react";
import {Toaster} from "react-hot-toast";
import {useSession} from "./use-session";
import {useSyncPropertyInterests} from "@/features/home/property-interests";
import {loginHref, openMarketplaceLogin} from "./login-return";
const MarketplaceSession = createContext<ReturnType<typeof useSession> | null>(null);

export function MarketplaceSessionProvider({children}: {children: ReactNode}) {
  const auth = useSession();
  useSyncPropertyInterests(auth.session);
  return <MarketplaceSession.Provider value={auth}>{children}<Toaster position="top-right" /></MarketplaceSession.Provider>;
}

export function useMarketplaceSession() {
  return useMarketplaceAuth()?.session ?? null;
}

export function useMarketplaceAuth() {
  return useContext(MarketplaceSession);
}

export function MarketplaceAccountLink({locale, label, header}: {locale: string; label: string; header?: boolean}) {
  const t = useTranslations("Site");
  const auth = useMarketplaceAuth();
  const session = auth?.session;
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const text = session ? label : t("signIn");
  const Icon = session ? LayoutDashboard : LogIn;
  const href = session ? `/${locale}/dashboard` : loginHref(locale);
  const signIn = session ? undefined : openMarketplaceLogin;
  if (header && session) return <div className="market-account-menu" onPointerEnter={(event) => {if (event.pointerType === "mouse") setOpen(true);}}
    onPointerLeave={(event) => {if (event.pointerType === "mouse" && !event.currentTarget.contains(document.activeElement)) setOpen(false);}}
    onBlur={(event) => {if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);}}
    onKeyDown={(event) => {if (event.key === "Escape" && open) {setOpen(false); trigger.current?.focus();}}}>
    <button className="market-account-icon" type="button" ref={trigger} aria-label={t("profile")} aria-expanded={open}
      onClick={(event) => setOpen(event.detail > 0 && matchMedia("(hover: hover)").matches ? true : !open)}>
      <UserRound size={21} aria-hidden="true" />
    </button>
    {open && <div className="market-account-links" data-motion="popover">
      <Link href={href} onClick={() => setOpen(false)}><LayoutDashboard size={16} aria-hidden="true" />{label}</Link>
      <Link href={href + "?view=profile"} onClick={() => setOpen(false)}><UserRound size={16} aria-hidden="true" />{t("manageProfile")}</Link>
      <button type="button" className="market-account-logout" disabled={auth.accountBusy} onClick={() => void auth.logout()}>
        <LogOut size={16} aria-hidden="true" />{t("logOut")}
      </button>
      {auth.error && <small role="alert">{auth.error.message}</small>}
    </div>}
  </div>;
  return header ? (
    <Link className="market-button market-dashboard-link" href={href} onClick={signIn} aria-label={text}>
      <Icon className="market-dashboard-icon" size={18} aria-hidden="true" />
      <span>{text}</span><ArrowUpRight className="market-dashboard-arrow" size={15} aria-hidden="true" />
    </Link>
  ) : <Link href={href} onClick={signIn}>{text}</Link>;
}
