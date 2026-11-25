import Link from "next/link";
import {ChevronRight} from "lucide-react";
import {useTranslations} from "next-intl";
import styles from "./marketplace-breadcrumbs.module.css";

export function MarketplaceBreadcrumbs({locale, parent, current}: {
  locale: string; parent?: {title: string; href: string}; current: string;
}) {
  const t = useTranslations("Site");
  return <nav className={styles.trail} aria-label="Breadcrumb">
    <ol><li><Link href={`/${locale}`}>{t("home")}</Link></li>
      {parent && <li><ChevronRight aria-hidden="true" size={13} /><Link href={parent.href}>{parent.title}</Link></li>}
      <li><ChevronRight aria-hidden="true" size={13} /><span aria-current="page">{current}</span></li>
    </ol>
  </nav>;
}
