"use client";

import {usePathname, useRouter} from "next/navigation";

export function useMobileSearchLink(locale: string) {
  const pathname = usePathname();
  const router = useRouter();
  const route = `/${locale}/search`;
  return {
    href: `${route}?from=${encodeURIComponent(pathname)}`,
    onNavigate(event: {preventDefault(): void}) {
      event.preventDefault();
      const {pathname, search, hash} = window.location;
      router.push(`${route}?from=${encodeURIComponent(pathname + search + hash)}`);
    },
  };
}
