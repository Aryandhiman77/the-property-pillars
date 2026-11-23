import {getRequestConfig} from "next-intl/server";
import {defaultLocale, isAppLocale} from "./config";
import english from "../messages/en.json";
import {articleLabels} from "./article-labels";
import {homeDiscoveryLabels} from "./home-discovery-labels";
import {propertyContactLabels} from "./property-contact-labels";

export default getRequestConfig(async ({requestLocale}) => {
  const requestedLocale = await requestLocale;
  const locale = isAppLocale(requestedLocale) ? requestedLocale : defaultLocale;
  const translated: Record<string, Record<string, string>> = locale === defaultLocale
    ? english
    : (await import(`../messages/${locale}.json`)).default;
  const messages: Record<string, Record<string, string>> = Object.fromEntries(Object.entries(english).map(([namespace, defaults]) => [
    namespace, {...defaults, ...translated[namespace]},
  ]));
  const {Navigation, Home, Footer, Site} = translated;
  messages.Articles = {...messages.Articles, ...articleLabels(locale)};
  messages.HomeDiscovery = homeDiscoveryLabels(locale);
  messages.PropertyContact = propertyContactLabels(locale);
  if (Navigation && locale !== defaultLocale) {
    messages.Site = {
      ...messages.Site,
      ...Navigation,
      listProperty: Navigation.post,
      homeTitle: Home.title,
      homeDescription: Home.description,
      allMarketplace: Home.pillarHeading,
      footerTagline: Footer.tagline,
      footerDisclaimer: Footer.disclaimer,
      ...Site,
    };
  }

  return {
    locale,
    messages
  };
});
