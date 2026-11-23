import {siteLocales} from "@the-property-pillar/contracts";

export const locales = siteLocales;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";

export function isAppLocale(value: string | undefined): value is AppLocale {
  return locales.includes(value as AppLocale);
}

export const localeNames: Record<AppLocale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  zh: "简体中文",
  ja: "日本語",
  hi: "हिन्दी",
  pa: "ਪੰਜਾਬੀ",
  gu: "ગુજરાતી",
  ta: "தமிழ்",
  mr: "मराठी",
  te: "తెలుగు",
  kn: "ಕನ್ನಡ",
  bn: "বাংলা",
  ar: "العربية"
};

export const localeFlags: Record<AppLocale, string> = {
  en: "gb", es: "es", fr: "fr", de: "de", pt: "br", zh: "cn", ja: "jp", ar: "sa",
  hi: "in", pa: "in", gu: "in", ta: "in", mr: "in", te: "in", kn: "in", bn: "bd"
};

export function localizePath(pathname: string, locale: AppLocale) {
  const [, current, ...rest] = pathname.split("/");
  return isAppLocale(current) ? `/${[locale, ...rest].join("/")}` : `/${locale}${pathname === "/" ? "" : pathname}`;
}
