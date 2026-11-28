"use client";

import {usePathname} from "next/navigation";
import {useLayoutEffect, useRef} from "react";

export function RouteScroll() {
  const path = usePathname();
  const previous = useRef(path);
  useLayoutEffect(() => {
    if (path !== previous.current && !window.location.hash) {
      window.scrollTo({top: 0, left: 0, behavior: "instant"});
    }
    previous.current = path;
  }, [path]);
  return null;
}
