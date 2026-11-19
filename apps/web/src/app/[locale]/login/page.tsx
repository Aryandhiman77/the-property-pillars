import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {setRequestLocale} from "next-intl/server";
import {safeLoginReturn} from "@the-property-pillar/contracts";
import {Login} from "@/features/auth/login";
import {isAppLocale} from "@/i18n/config";

export const metadata: Metadata = {title: "Sign in", robots: {index: false, follow: false}};

export default async function LoginPage({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{next?: string | string[]; google?: string | string[]}>;
}) {
  const [{locale}, query] = await Promise.all([params, searchParams]);
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  return <Login locale={locale} next={safeLoginReturn(query.next, locale)} google={typeof query.google === "string" ? query.google : undefined} />;
}
