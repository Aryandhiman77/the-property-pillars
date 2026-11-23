import {directories, isDirectory} from "@/config/marketplace";
import {propertyEnquiryHref, publicTasks, type PublicTaskPath} from "@/config/public-tasks";
import {redirect} from "next/navigation";
import type {AppLocale} from "@/i18n/config";
import {MarketplaceBreadcrumbs, MarketplaceShell} from "./marketplace-shell";
import {getTranslations} from "next-intl/server";
import {PublicTask} from "./public-task";

export type TaskSearchParams = Record<string, string | string[] | undefined>;

export async function PublicTaskPage({locale, path, query}: {locale: AppLocale; path: PublicTaskPath; query: TaskSearchParams}) {
  const t = await getTranslations("Site");
  const task = publicTasks[path];
  const project = path === "properties/enquire" && query.kind === "project";
  const id = typeof query.record === "string" && /^[a-zA-Z0-9_-]{1,120}$/.test(query.record) ? query.record : undefined;
  if (path === "properties/enquire" && !project) redirect(id ? propertyEnquiryHref(locale, id) : `/${locale}/properties`);
  const title = typeof query.title === "string" ? query.title.trim().slice(0, 160) : undefined;
  const data: Record<string, unknown> = {};
  if (path === "properties/enquire") {
    data.projectId = id ?? "";
    data.inquiryType = "CALLBACK";
  }
  if (path === "jobs/apply" && id) data.jobId = id;
  if (path === "professionals/request" && id) data.serviceProfileId = id;
  if (path === "properties/save-search") {
    if (typeof query.city === "string") data.city = query.city.trim().slice(0, 80);
    if (query.intent === "SALE" || query.intent === "RENT") data.listingIntent = query.intent;
  }
  const parent = task.directory ? {href: `/${locale}/${task.directory}`, title: t(isDirectory(task.directory) ? directories[task.directory].title : "finance")} : undefined;
  return <MarketplaceShell locale={locale}>
    <MarketplaceBreadcrumbs locale={locale} parent={parent} current={t(task.title)} />
    <PublicTask locale={locale} path={path} initial={{title, data}} project={project} />
  </MarketplaceShell>;
}
