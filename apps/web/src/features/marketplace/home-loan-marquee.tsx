"use client";

import useMediaQuery from "@mui/material/useMediaQuery";
import {ArrowUpRight} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import {useLocale, useNow, useTranslations} from "next-intl";
import {useEffect, useId, useRef, useState} from "react";
import {bankHomeLoans} from "@/config/home-loan-banks";
import {homeLoanOffers, offerExpired, ratesReviewedOn} from "@/config/home-loan-rates";
import styles from "./home-loan-marquee.module.css";

export function HomeLoanMarquee() {
  const t = useTranslations("Site");
  const locale = useLocale();
  const now = useNow({updateInterval: 60_000});
  const date = new Intl.DateTimeFormat(locale, {day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata"});
  const id = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const firstGroup = useRef<HTMLUListElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [touching, setTouching] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  function cancelOpen() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }

  useEffect(() => {
    const rail = viewport.current;
    if (!rail) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(rail);
    function resetInteraction() {
      cancelOpen();
      setTouching(false);
      setHovered(false);
      setFocused(false);
    }
    window.addEventListener("pageshow", resetInteraction);
    document.addEventListener("visibilitychange", resetInteraction);
    window.addEventListener("blur", cancelOpen);
    window.addEventListener("scroll", cancelOpen);
    return () => {
      observer.disconnect();
      window.removeEventListener("pageshow", resetInteraction);
      document.removeEventListener("visibilitychange", resetInteraction);
      cancelOpen();
      window.removeEventListener("blur", cancelOpen);
      window.removeEventListener("scroll", cancelOpen);
    };
  }, []);

  useEffect(() => {
    const rail = viewport.current;
    const group = firstGroup.current;
    if (!rail || !group || !visible || touching || hovered || focused || reducedMotion) return;
    let frame: number;
    let previous = 0;
    let position = rail.scrollLeft;
    function advance(time: number) {
      if (previous && rail && group) {
        position = (position + Math.min(time - previous, 64) * 0.032) % group.offsetWidth;
        rail.scrollLeft = position;
      }
      previous = time;
      frame = requestAnimationFrame(advance);
    }
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [visible, touching, hovered, focused, reducedMotion]);

  return <section className={styles.section} aria-labelledby={id}>
    <header className={styles.header}>
      <div>
        <h3 id={id}>{t("compareHomeLoanRates", {count: homeLoanOffers.length})}</h3>
        <p>{t("bankRatesChecked", {date: date.format(new Date(ratesReviewedOn))})}</p>
      </div>
      <Link className={styles.action} href={`/${locale}/finance-services#eligibility`}>{t("checkLoanEligibility")} <ArrowUpRight size={14} /></Link>
    </header>
    <p className={styles.hint}>{t("bankMarqueeHint")}</p>
    <div ref={viewport} className={styles.viewport} dir="ltr"
      onPointerEnter={event => {if (event.pointerType === "mouse") setHovered(true);}}
      onPointerLeave={() => {setHovered(false); cancelOpen();}}
      onPointerDown={() => {cancelOpen(); setFocused(false);}}
      onTouchStart={() => setTouching(true)} onTouchEnd={() => setTouching(false)} onTouchCancel={() => setTouching(false)}
      onFocusCapture={event => setFocused(event.target.matches(":focus-visible"))}
      onClickCapture={() => setFocused(false)}
      onBlurCapture={event => {if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);}}
      onKeyDown={cancelOpen}>
      <div className={styles.track}>
        {(reducedMotion ? [false] : [false, true]).map(copy =>
          <ul className={styles.group} key={String(copy)} ref={copy ? undefined : firstGroup} aria-hidden={copy || undefined}>
            {homeLoanOffers.map(bank => {
              const logo = bankHomeLoans.find(item => item.name === bank.name);
              const expired = offerExpired(bank.validThrough, now);
              return <li key={bank.name} className={styles.card}>
                <a className={styles.apply} href={bank.loanPageUrl ?? bank.applyUrl} tabIndex={copy ? -1 : undefined}
                  aria-label={bank.name + " · " + t("applyWithBank")}
                  onPointerMove={event => {
                    if (event.pointerType !== "mouse" || event.buttons || timer.current !== null) return;
                    const link = event.currentTarget;
                    timer.current = setTimeout(() => {
                      timer.current = null;
                      if (!document.hidden && link.matches(":hover")) window.location.assign(link.href);
                    }, 1200);
                  }}
                  onPointerLeave={cancelOpen} onClick={cancelOpen} onContextMenu={cancelOpen}>
                  <span className={styles.name} lang="en">{logo
                    ? <Image src={`/images/banks/${logo.id}.webp`} alt={bank.name} width={logo.width} height={logo.height} unoptimized />
                    : bank.name}</span>
                  <strong className={styles.rate}>{expired ? t("checkBankRate") : <>{bank.rate} <small>p.a.</small></>}</strong>
                  <span className={styles.terms} lang="en">{bank.terms}</span>
                  <span className={styles.action}>{t("applyWithBank")} <ArrowUpRight aria-hidden="true" size={14} /></span>
                </a>
                <div className={styles.sources}>
                  <a href={bank.rateUrl} target="_blank" rel="noopener noreferrer" tabIndex={copy ? -1 : undefined}
                    aria-label={bank.name + " · " + t("bankRateSheet")}>{t("bankRateSheet")}</a>
                  {bank.loanPageUrl && <a href={bank.applyUrl} tabIndex={copy ? -1 : undefined}>{t("bankApplicationPortal")}</a>}
                  {bank.validThrough && <span>{t("bankRateUntil", {date: date.format(new Date(bank.validThrough))})}</span>}
                </div>
              </li>;
            })}
          </ul>
        )}
      </div>
    </div>
  </section>;
}
