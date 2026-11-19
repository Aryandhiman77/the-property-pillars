import {siteLocales} from "@the-property-pillar/contracts";

export const locales = siteLocales;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";

export function isAppLocale(value: string | undefined): value is AppLocale {
  return locales.includes(value as AppLocale);
}

export const localeNames: Record<AppLocale, string> = {
  en: "English",
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
