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
  searchParams: Promise<{view?: string; create?: string; lead?: string; property?: string}>;
}) {
  const [{locale}, query] = await Promise.all([params, searchParams]);
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);

  const requested = query.view === "propertyInquiries" ? query.lead : query.view === "properties" ? query.property : undefined;
  const record = requested && /^[a-z0-9_-]{1,80}$/i.test(requested) ? requested : undefined;
  return <DashboardPageView createProperty={query.create === "property"} initialView={query.view} initialRecord={record} locale={locale} />;
}

