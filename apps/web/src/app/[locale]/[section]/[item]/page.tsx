import Link from "next/link";
import {setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {isDirectory} from "@/config/marketplace";
import {isPublicTask, publicTaskHref} from "@/config/public-tasks";
import {MarketplaceDirectory} from "@/features/marketplace/directory";
import {MarketplaceShell} from "@/features/marketplace/marketplace-shell";
import {PublicTaskPage, type TaskSearchParams} from "@/features/marketplace/public-task-page";
import {isAppLocale} from "@/i18n/config";

export default async function DirectoryItemPage({params, searchParams}: {params: Promise<{locale: string; section: string; item: string}>; searchParams: Promise<TaskSearchParams>}) {
  const {locale, section, item} = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const path = `${section}/${item}`;
  if (isPublicTask(path)) return <PublicTaskPage locale={locale} path={path} query={await searchParams} />;
  const collection = section === "dealer" ? "dealers" : section;
  if (!isDirectory(collection) || item.length > 120) notFound();
  return (
    <MarketplaceShell locale={locale} currentPath={collection}>
      <MarketplaceDirectory kind={collection} locale={locale} selected={item} initialCity="" initialIntent="" />
      {collection === "dealers" && <p className="market-footer-note">Powered by ThePropertyPillar.com. <Link className="market-text-link" href={publicTaskHref(locale, "dealers/register")}>Create your dealer website</Link></p>}
    </MarketplaceShell>
  );
}
