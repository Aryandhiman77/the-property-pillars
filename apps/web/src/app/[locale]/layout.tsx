import type {Metadata} from "next";
import {NextIntlClientProvider} from "next-intl";
import {getMessages, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {isAppLocale, locales} from "@/i18n/config";
import {SiteLocationProvider} from "@/features/location/site-location";
import {countriesForLocale} from "@/config/listing-geography";
import {RouteScroll} from "@/components/layout/route-scroll";
import {WebsiteTheme} from "@/features/home/website-theme";
import {MaterialTheme} from "@/components/ui/material-theme";
import "../globals.css";

export const metadata: Metadata = {
  icons: {icon: {url: "/images/property-pillar-icon.png", type: "image/png", sizes: "128x128"}},
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "ThePropertyPillar",
    template: "%s | ThePropertyPillar"
  },
  description:
    "Property, construction materials, finance, professional services and workforce on one trusted platform."
};

export function generateStaticParams() {
  return locales.map((locale) => ({locale}));
}

export default async function LocaleLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}>) {
  const {locale} = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
      <body suppressHydrationWarning>
        <MaterialTheme rtl={locale === "ar"}>
          <NextIntlClientProvider messages={messages}>
            <RouteScroll />
            <WebsiteTheme />
            <SiteLocationProvider countryOptions={countriesForLocale(locale)}>{children}</SiteLocationProvider>
          </NextIntlClientProvider>
        </MaterialTheme>
      </body>
    </html>
  );
}
