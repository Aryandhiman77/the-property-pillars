import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {setRequestLocale} from "next-intl/server";

import {isAppLocale} from "@/i18n/config";
import {DashboardPageView} from "./dashboard-page";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Role-specific property, construction, finance and workforce operations.",
  robots: {index: false, follow: false},
};

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{view?: string; create?: string}>;
}) {
  const [{locale}, query] = await Promise.all([params, searchParams]);
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);

  return <DashboardPageView createProperty={query.create === "property"} initialView={query.view} locale={locale} />;
}

