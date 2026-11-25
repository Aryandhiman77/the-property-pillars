"use client";

import Button from "@mui/material/Button";
import {ArrowRight, Headphones, House, Percent, Scale, Zap} from "lucide-react";
import Image from "next/image";
import {useNow, useTranslations} from "next-intl";
import {lowestHomeLoanOffer} from "@/config/home-loan-rates";
import styles from "./home-loan-hero.module.css";

export function HomeLoanHero() {
  const t = useTranslations("Site");
  const lowest = lowestHomeLoanOffer(useNow({updateInterval: 60_000}));
  const features = [
    {icon: Zap, title: t("loanHeroEstimate"), hint: t("loanHeroEstimateHint"), href: "#eligibility"},
    {icon: Percent, title: t("loanHeroCompareLabel"), hint: t("loanHeroCompareHint"), href: "#bank-offers"},
    {icon: Headphones, title: t("loanHeroHelp"), hint: t("loanHeroHelpHint"), href: "#loan-enquiry"},
  ];
  return <header className={styles.hero} aria-labelledby="home-loan-title">
    <div className={styles.visual}>
      <Image src="/images/banners/home-loan-courtyard.webp" alt="" fill priority sizes="(max-width: 760px) 100vw, 56vw" />
      {lowest && <a className={styles.rate} href="#bank-offers">
        <span>{t("loanHeroRates")}</span><strong>{lowest.rate.toFixed(2)}%</strong><small>{t("loanHeroRateUnit")}</small>
      </a>}
    </div>
    <div className={styles.content}>
      <span className={styles.label}><House size={16} aria-hidden="true" />{t("loanHeroLabel")}</span>
      <h1 id="home-loan-title">{t("homeLoansIndia")}</h1>
      <p>{t("loanHeroIntro")}</p>
      <div className={styles.actions}>
        <Button href="#eligibility" variant="contained" disableElevation endIcon={<ArrowRight />}>{t("checkLoanEligibility")}</Button>
        <Button href="#bank-offers" variant="outlined" startIcon={<Scale />}>{t("loanHeroCompare")}</Button>
      </div>
      <ul className={styles.features}>{features.map(({icon: Icon, title, hint, href}) =>
        <li key={href}><a href={href} aria-haspopup={href === "#loan-enquiry" ? "dialog" : undefined}>
          <Icon size={20} aria-hidden="true" /><span><b>{title}</b><small>{hint}</small></span>
        </a></li>)}</ul>
    </div>
  </header>;
}
