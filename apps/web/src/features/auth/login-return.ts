import {safeLoginReturn} from "@the-property-pillar/contracts";
import type {MouseEvent} from "react";

export const loginRequestEvent = "tpp:sign-in";

export function loginHref(locale: string, next?: string) {
  return `/${locale}/login${next ? "?" + new URLSearchParams({next: safeLoginReturn(next, locale)}) : ""}`;
}

export function openMarketplaceLogin(event: MouseEvent<HTMLAnchorElement>) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!window.dispatchEvent(new Event(loginRequestEvent, {cancelable: true}))) event.preventDefault();
}
