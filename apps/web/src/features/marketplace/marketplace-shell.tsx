import type {ReactNode} from "react";
import {ArrowUpRight} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
export {MarketplaceBreadcrumbs} from "@/components/layout/marketplace-breadcrumbs";
import styles from "./directory.module.css";

export function MarketplaceShell({children, fullWidthIntro}: {children: ReactNode; fullWidthIntro?: ReactNode}) {
  return <main className={fullWidthIntro ? styles.page : "market-width " + styles.page}>
    {fullWidthIntro}
    {fullWidthIntro ? <div className="market-width">{children}</div> : children}
  </main>;
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
