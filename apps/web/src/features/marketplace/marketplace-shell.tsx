import type {ReactNode} from "react";
import {ArrowUpRight} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
export {MarketplaceBreadcrumbs} from "@/components/layout/marketplace-breadcrumbs";
import {MarketplaceHeader} from "@/components/layout/marketplace-header";
import {MarketplaceFooter} from "@/components/layout/marketplace-footer";
import {MarketplaceMobileNav} from "@/components/layout/marketplace-mobile-nav";
import {MarketplaceSessionProvider} from "@/features/auth/marketplace-session";
import {PropertyShortlistProvider} from "./property-shortlist";
import type {AppLocale} from "@/i18n/config";
import "@/features/home/marketplace.css";
import styles from "./directory.module.css";

export function MarketplaceShell({locale, children, articleReader = false, fullWidthIntro}: {locale: AppLocale; children: ReactNode; articleReader?: boolean; fullWidthIntro?: ReactNode}) {
  return (
    <MarketplaceSessionProvider><PropertyShortlistProvider locale={locale}><div className="market">
      <MarketplaceHeader locale={locale} articleReader={articleReader} />
      <main className={`${fullWidthIntro ? "" : "market-width"} ${styles.page}`}>
        {fullWidthIntro}
        {fullWidthIntro ? <div className="market-width">{children}</div> : children}
      </main>
      <MarketplaceFooter locale={locale} />
      <MarketplaceMobileNav locale={locale} />
    </div></PropertyShortlistProvider></MarketplaceSessionProvider>
  );
}

export function MarketplaceHeading({title, description, action, image}: {
  title: string;
  description: string;
  action: {label: string; href: string};
  image: string;
}) {
  return (
    <header className={styles.heading}>
      <div className={styles.headingBody} data-motion="enter">
        <h1>{title}</h1>
        <p>{description}</p>
        <Link className={styles.primaryButton} href={action.href}>
          {action.label}<ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </div>
      <div className={styles.headingVisual}>
        <Image alt="" className={styles.headingPhoto} fill priority sizes="(max-width: 760px) 1px, 30vw" src={image} />
      </div>
    </header>
  );
}
