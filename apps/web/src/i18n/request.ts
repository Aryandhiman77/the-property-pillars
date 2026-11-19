import {getRequestConfig} from "next-intl/server";
import {defaultLocale, isAppLocale} from "./config";

const supportedMessageLocales = ["en", "hi", "pa", "gu", "ta"] as const;

export default getRequestConfig(async ({requestLocale}) => {
  const requestedLocale = await requestLocale;
  const locale = isAppLocale(requestedLocale) ? requestedLocale : defaultLocale;
  const messageLocale = supportedMessageLocales.includes(
    locale as (typeof supportedMessageLocales)[number]
  )
    ? locale
    : defaultLocale;
  const messages = (await import(`../messages/${messageLocale}.json`)).default;

  return {
    locale,
    messages
  };
});
