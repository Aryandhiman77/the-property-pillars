import type {Metadata} from "next";
import {NextIntlClientProvider} from "next-intl";
import {getMessages, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {isAppLocale, locales} from "@/i18n/config";
import {SiteLocationProvider} from "@/features/location/site-location";
import "../globals.css";

export const metadata: Metadata = {
  icons: {icon: {url: "/images/property-pillar-ruby-icon.png", type: "image/png", sizes: "128x128"}},
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
        <NextIntlClientProvider messages={messages}>
          <SiteLocationProvider>{children}</SiteLocationProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
