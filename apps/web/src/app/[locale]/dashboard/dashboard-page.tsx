import {DashboardApp} from "@/features/dashboard/dashboard-app";

type DashboardPageViewProps = {
  locale: string;
  initialView?: string;
  initialRecord?: string;
};

export function DashboardPageView({locale, initialView, initialRecord}: DashboardPageViewProps) {
  return <DashboardApp initialView={initialView} initialRecord={initialRecord} locale={locale} />;
}

