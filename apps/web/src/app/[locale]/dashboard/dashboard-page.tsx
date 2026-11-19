import {DashboardApp} from "@/features/dashboard/dashboard-app";

type DashboardPageViewProps = {
  locale: string;
  initialView?: string;
  createProperty?: boolean;
};

export function DashboardPageView({locale, initialView, createProperty}: DashboardPageViewProps) {
  return <DashboardApp createProperty={createProperty} initialView={initialView} locale={locale} />;
}

