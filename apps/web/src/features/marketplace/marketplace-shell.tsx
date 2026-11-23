import type {ReactNode} from "react";
import {ArrowUpRight, ChevronRight, type LucideIcon} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {getTranslations} from "next-intl/server";
import {MarketplaceHeader} from "@/components/layout/marketplace-header";
import {MarketplaceFooter} from "@/components/layout/marketplace-footer";
import {MarketplaceMobileNav} from "@/components/layout/marketplace-mobile-nav";
import {MarketplaceSessionProvider} from "@/features/auth/marketplace-session";
import {PropertyShortlistProvider} from "./property-shortlist";
import type {AppLocale} from "@/i18n/config";
import "@/features/home/marketplace.css";
import styles from "./directory.module.css";

export function MarketplaceShell({locale, children, articleReader = false}: {locale: AppLocale; children: ReactNode; articleReader?: boolean}) {
  return (
    <MarketplaceSessionProvider><PropertyShortlistProvider locale={locale}><div className="market">
      <MarketplaceHeader locale={locale} articleReader={articleReader} />
      <main className={`market-width ${styles.page}`}>{children}</main>
      <MarketplaceFooter locale={locale} />
      <MarketplaceMobileNav locale={locale} />
    </div></PropertyShortlistProvider></MarketplaceSessionProvider>
  );
}

export async function MarketplaceBreadcrumbs({locale, parent, current}: {
  locale: string;
  parent?: {title: string; href: string};
  current: string;
}) {
  const t = await getTranslations("Site");
  return (
    <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
      <ol>
        <li><Link href={`/${locale}`}>{t("home")}</Link></li>
        {parent && <li><ChevronRight size={13} aria-hidden="true" /><Link href={parent.href}>{parent.title}</Link></li>}
        <li><ChevronRight size={13} aria-hidden="true" /><span aria-current="page">{current}</span></li>
      </ol>
    </nav>
  );
}

export function MarketplaceHeading({icon: Icon, title, description, action, image}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action: {label: string; href: string};
  image: string;
}) {
  return (
    <header className={styles.heading}>
      <div className={styles.headingBody} data-motion="enter">
        <span className={styles.headingIcon}><Icon size={22} aria-hidden="true" /></span>
        <h1>{title}</h1>
        <p>{description}</p>
        <Link className={styles.primaryButton} href={action.href}>
          {action.label}<ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </div>
      <div className={styles.headingVisual}>
        <Image alt="" className={styles.headingPhoto} fill priority sizes="(max-width: 760px) calc(100vw - 32px), 55vw" src={image} />
      </div>
    </header>
  );
}
