import Link from "next/link";
import {notFound} from "next/navigation";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {X} from "lucide-react";
import {safeLoginReturn} from "@the-property-pillar/contracts";
import {isAppLocale} from "@/i18n/config";
import {MarketSearch} from "@/features/home/market-search";
import "@/features/home/marketplace.css";
import styles from "@/features/home/market-search.module.css";

export default async function SearchPage({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{from?: string}>;
}) {
  const [{locale}, {from}] = await Promise.all([params, searchParams]);
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("Site");
  const home = `/${locale}`;
  const sourcePath = typeof from === "string" ? from.split(/[?#]/)[0].replace(/\/$/, "") : "";
  const closeHref = typeof from === "string" && safeLoginReturn(from, locale) === from &&
    (sourcePath === home || sourcePath.startsWith(home + "/")) && sourcePath !== home + "/search" ? from : home;
  return <main className={`market ${styles.searchPage}`}>
    <div className={styles.pageInner}>
      <header className={styles.pageHead}><h1>{t("advancedSearch")}</h1>
        <Link replace href={closeHref} aria-label={t("close")}><X aria-hidden="true" size={22} /></Link>
      </header>
      <MarketSearch locale={locale} advanced />
    </div>
  </main>;
}
