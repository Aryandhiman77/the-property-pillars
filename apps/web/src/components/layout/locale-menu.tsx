"use client";

import {Suspense} from "react";
import {ChevronDown, Globe2} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {usePathname, useSearchParams} from "next/navigation";
import {safeLoginReturn} from "@the-property-pillar/contracts";
import {locales, localeFlags, localeNames, localizePath, type AppLocale} from "@/i18n/config";
import "flag-icons/css/flag-icons.min.css";
import styles from "./locale-menu.module.css";

function LanguageLinks({current, articleSlug}: {current: AppLocale; articleSlug?: string}) {
  const pathname = usePathname();
  const query = useSearchParams().toString();

  return locales.map((locale) => {
    const params = new URLSearchParams(query);
    if (pathname === `/${current}/login` && params.has("next")) {
      const next = new URL(safeLoginReturn(params.get("next"), current), "https://login-return.invalid");
      params.set("next", localizePath(next.pathname, locale) + next.search + next.hash);
    }
    const href = articleSlug ? `/${locale}/articles/${encodeURIComponent(articleSlug)}` : localizePath(pathname, locale) + (params.size ? `?${params}` : "");
    return <a key={locale} href={href} hrefLang={locale} lang={locale} dir="auto"
      aria-current={locale === current ? "page" : undefined}
      onClick={(event) => {if (!articleSlug) event.currentTarget.hash = window.location.hash;}}>
      <span className={`fi fi-${localeFlags[locale]} ${styles.flag}`} aria-hidden="true" />
      <span>{localeNames[locale]}</span>
    </a>;
  });
}

export function LocaleMenu({articleSlug}: {articleSlug?: string} = {}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Site");
  return <details className={styles.switcher} name="marketplace-header-menus" onKeyDown={(event) => {
    if (event.key === "Escape" && event.currentTarget.open) {
      event.currentTarget.open = false;
      event.currentTarget.querySelector("summary")?.focus();
    }
  }}>
    <summary aria-label={`${locale.toUpperCase()} · ${t("language")}, ${localeNames[locale]}`}>
      <Globe2 size={17} aria-hidden="true" />{locale.toUpperCase()}<ChevronDown size={12} aria-hidden="true" />
    </summary>
    <div className={styles.options} data-motion="popover">
      <Suspense><LanguageLinks current={locale} articleSlug={articleSlug} /></Suspense>
    </div>
  </details>;
}
