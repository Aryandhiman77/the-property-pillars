"use client";

import {useEffect, useRef, useState, type ReactNode} from "react";
import {ChevronLeft, ChevronRight} from "lucide-react";
import styles from "./home-sections.module.css";

export function HomeRail({children, className = "", label}: {children: ReactNode; className?: string; label: string}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({previous: false, next: false});
  useEffect(() => {
    const rail = ref.current;
    if (!rail) return;
    const measure = () => {
      const offset = Math.abs(rail.scrollLeft);
      const previous = offset > 3;
      const next = offset < rail.scrollWidth - rail.clientWidth - 3;
      setEdges((current) => current.previous === previous && current.next === next ? current : {previous, next});
    };
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    for (const item of Array.from(rail.children)) observer.observe(item);
    rail.addEventListener("scroll", measure, {passive: true});
    measure();
    return () => {observer.disconnect(); rail.removeEventListener("scroll", measure);};
  }, [children]);

  function move(direction: number) {
    const rail = ref.current;
    if (!rail?.firstElementChild) return;
    const {direction: flow, columnGap} = getComputedStyle(rail);
    const step = rail.firstElementChild.getBoundingClientRect().width + (parseFloat(columnGap) || 0);
    rail.scrollBy({left: step * direction * (flow === "rtl" ? -1 : 1), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
  }
  return <div className={styles.railFrame}>
    <div className={`${styles.rail} ${className}`} ref={ref}>{children}</div>
    {edges.previous && <button type="button" className={`${styles.railArrow} ${styles.railBack}`} onClick={() => move(-1)} aria-label={`Previous ${label}`}><ChevronLeft size={20} aria-hidden="true" /></button>}
    {edges.next && <button type="button" className={`${styles.railArrow} ${styles.railNext}`} onClick={() => move(1)} aria-label={`Next ${label}`}><ChevronRight size={20} aria-hidden="true" /></button>}
  </div>;
}
