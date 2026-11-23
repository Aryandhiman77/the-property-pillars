"use client";

import {useEffect, useRef, type ReactNode} from "react";

export function HomeMain({children}: {children: ReactNode}) {
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver((entries) => {
      for (const {target, isIntersecting} of entries) {
        if (!isIntersecting) continue;
        target.setAttribute("data-revealed", "");
        observer.unobserve(target);
      }
    }, {rootMargin: "0px 0px 6% 0px"});

    main.current?.querySelectorAll("[data-reveal-on-scroll]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return <main id="market-main" ref={main}>{children}</main>;
}
