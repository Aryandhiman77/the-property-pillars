import type {ReactNode} from "react";
import {ArrowUpRight, ChevronRight, type LucideIcon} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {getTranslations} from "next-intl/server";
import {MarketplaceHeader} from "@/components/layout/marketplace-header";
import {MarketplaceFooter} from "@/components/layout/marketplace-footer";
import {MarketplaceMobileNav} from "@/components/layout/marketplace-mobile-nav";
import {MarketplaceSessionProvider} from "@/features/auth/marketplace-session";
import type {AppLocale} from "@/i18n/config";
import "@/features/home/marketplace.css";
import styles from "./directory.module.css";

export async function MarketplaceShell({locale, currentPath, children}: {locale: AppLocale; currentPath: string; children: ReactNode}) {
  const [nav, footer] = await Promise.all([getTranslations("Navigation"), getTranslations("Footer")]);
  return (
    <MarketplaceSessionProvider><div className="market">
      <MarketplaceHeader locale={locale} currentPath={currentPath} labels={{
        properties: nav("properties"), materials: nav("materials"), services: nav("services"), jobs: nav("jobs"),
        dashboard: nav("dashboard"), language: nav("language"),
      }} />
      <main className={`market-width ${styles.page}`}>{children}</main>
      <MarketplaceFooter locale={locale} tagline={footer("tagline")} disclaimer={footer("disclaimer")} />
      <MarketplaceMobileNav locale={locale} labels={{home: nav("home"), search: nav("search"), post: nav("post"), alerts: nav("alerts"), dashboard: nav("dashboard")}} />
    </div></MarketplaceSessionProvider>
  );
}

export function MarketplaceBreadcrumbs({locale, parent, current}: {
  locale: string;
  parent?: {title: string; href: string};
  current: string;
}) {
  return (
    <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
      <ol>
        <li><Link href={`/${locale}`}>Home</Link></li>
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
      <div className={styles.headingBody}>
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
