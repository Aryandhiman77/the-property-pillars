"use client";

import {useEffect, useRef, type ReactNode} from "react";
import styles from "./mobile-app-section.module.css";

export function MobileAppReveal({children}: {children: ReactNode}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current || !("IntersectionObserver" in window)) return;
    const panels = Array.from(container.current.children);
    const observer = new IntersectionObserver(entries => {
      for (const {target, isIntersecting, intersectionRatio} of entries) {
        if (!isIntersecting) target.setAttribute("data-promo-motion", "waiting");
        else if (intersectionRatio >= 0.08) target.setAttribute("data-promo-motion", "visible");
      }
    }, {threshold: [0, 0.08]});
    panels.forEach(panel => observer.observe(panel));
    return () => observer.disconnect();
  }, []);

  return <div ref={container} className={styles.inner}>{children}</div>;
}
