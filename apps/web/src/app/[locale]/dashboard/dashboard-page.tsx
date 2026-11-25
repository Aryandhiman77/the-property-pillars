import {DashboardApp} from "@/features/dashboard/dashboard-app";

type DashboardPageViewProps = {
  locale: string;
  initialView?: string;
  initialRecord?: string;
  createProperty?: boolean;
};

export function DashboardPageView({locale, initialView, initialRecord, createProperty}: DashboardPageViewProps) {
  return <DashboardApp createProperty={createProperty} initialView={initialView} initialRecord={initialRecord} locale={locale} />;
}

