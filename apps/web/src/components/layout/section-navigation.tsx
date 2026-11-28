"use client";

import Link from "next/link";
import {useEffect, useId, useRef, useState} from "react";
import {ChevronLeft, ChevronRight} from "lucide-react";
import {useTranslations} from "next-intl";

export function SectionNavigation({locale, links}: {locale: string; links: {path: string; label: string}[]}) {
  const t = useTranslations("Site");
  const rail = useRef<HTMLDivElement>(null);
  const id = useId();
  const [edges, setEdges] = useState({start: true, end: false});

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    function measure() {
      if (!el) return;
      const remaining = el.scrollWidth - el.clientWidth;
      const offset = Math.abs(el.scrollLeft);
      const start = offset < 2, end = remaining - offset < 2;
      setEdges(old => old.start === start && old.end === end ? old : {start, end});
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", measure, {passive: true});
    return () => {observer.disconnect(); el.removeEventListener("scroll", measure);};
  }, []);

  function move(direction: number) {
    const el = rail.current;
    if (!el) return;
    const sign = getComputedStyle(el).direction === "rtl" ? -1 : 1;
    el.scrollBy({left: sign * direction * el.clientWidth * .85,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
  }

  return <nav className="market-section-nav" aria-label={t("allMarketplace")}>
    <div className="market-width market-section-bar">
      <button type="button" aria-label={t("previousSections")} aria-controls={id} disabled={edges.start} onClick={() => move(-1)}><ChevronLeft /></button>
      <div className="market-section-links" id={id} ref={rail}>
        {links.map(({path, label}) => <Link key={path} href={`/${locale}/${path}`}>
          {label}
        </Link>)}
      </div>
      <button type="button" aria-label={t("nextSections")} aria-controls={id} disabled={edges.end} onClick={() => move(1)}><ChevronRight /></button>
    </div>
  </nav>;
}
