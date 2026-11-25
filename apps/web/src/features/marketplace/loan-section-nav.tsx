"use client";

import {useLayoutEffect, useRef, type ReactNode} from "react";
import styles from "./home-loan-guide.module.css";

export function LoanSectionNav({children}: {children: ReactNode}) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const nav = ref.current!;
    const page = nav.parentElement!;
    const header = nav.closest(".market")?.querySelector<HTMLElement>(".market-header");
    if (!header) return;
    const measure = () => {
      page.style.setProperty("--loan-header-height", header.offsetHeight + "px");
      page.style.setProperty("--loan-nav-height", nav.offsetHeight + "px");
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);
  return <nav ref={ref} className={styles.jump} aria-label="Home loan sections">{children}</nav>;
}
