"use client";

import dynamic from "next/dynamic";
import {usePathname} from "next/navigation";
import {useLocale, useTranslations} from "next-intl";
import {useEffect, useRef, useState} from "react";
import {MarketSidebar} from "@/components/layout/market-sidebar";

const PublicTask = dynamic(() => import("./public-task").then(module => module.PublicTask));
export function LoanEnquirySidebar() {
  const t = useTranslations("Site");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const fromPage = useRef(false);
  useEffect(() => {
    const sync = (event?: HashChangeEvent) => {
      const active = location.hash === "#loan-enquiry";
      fromPage.current = Boolean(active && event && new URL(event.oldURL).hash !== "#loan-enquiry");
      setOpen(active);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);
  function close() {
    if (fromPage.current) history.back();
    else history.replaceState(history.state, "", location.pathname + location.search);
    setOpen(false);
  }
  return open && <MarketSidebar label={t("loanEnquiry")} closeLabel={t("close")} close={close}>
    <PublicTask locale={locale} path="finance-services/apply" project={false} embedded
      initial={{data: {loanType: "HOME_LOAN", currency: "INR"}}} />
  </MarketSidebar>;
}
