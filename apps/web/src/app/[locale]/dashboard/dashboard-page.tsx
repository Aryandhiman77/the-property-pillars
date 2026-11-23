import {DashboardApp} from "@/features/dashboard/dashboard-app";

type DashboardPageViewProps = {
  locale: string;
  initialView?: string;
  initialLead?: string;
  createProperty?: boolean;
};

export function DashboardPageView({locale, initialView, initialLead, createProperty}: DashboardPageViewProps) {
  return <DashboardApp createProperty={createProperty} initialView={initialView} initialLead={initialLead} locale={locale} />;
}

