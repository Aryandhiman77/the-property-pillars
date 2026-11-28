"use client";
import Image from "next/image";
import Link from "next/link";
import {ArrowRight} from "lucide-react";
import {useTranslations} from "next-intl";
import {publicTaskHref} from "@/config/public-tasks";
import styles from "./building-materials.module.css";

const categories = [
  {value: "CEMENT", label: "cement", photo: "65 362 465 172"},
  {value: "TMT_STEEL", label: "steel", photo: "567 362 465 172"},
  {value: "BRICKS_BLOCKS", label: "bricks", photo: "1070 362 465 172"},
  {value: "TILES", label: "tiles", photo: "65 636 465 143"},
  {value: "PAINTS", label: "paints", photo: "567 636 465 143"},
  {value: "ELECTRICALS", label: "electrical", photo: "1070 636 465 143"},
] as const;

export function BuildingMaterials({locale}: {locale: string}) {
  const t = useTranslations("BuildingMaterials");
  const site = useTranslations("Site");
  const catalogue = `/${locale}/materials`;
  return <section id="building-materials" className={styles.section} aria-labelledby="building-materials-heading">
    <div className={`market-width ${styles.banner}`}>
      <div className={styles.copy}>
        <h2 id="building-materials-heading">{site("buildingMaterials")}</h2>
        <p>{t("description")}</p>
        <div className={styles.actions}>
          <Link href={`${catalogue}#material-catalogue`} className={styles.browse}>{t("browse")} <ArrowRight size={19} aria-hidden="true"/></Link>
          <Link href={publicTaskHref(locale, "materials/request-quote")} className={styles.quote}>
            {site("requestMaterials")} <ArrowRight size={19} aria-hidden="true"/>
          </Link>
        </div>
      </div>
      <div className={styles.photo}>
        <Image src="/images/daylight/building-materials-still-life.webp" alt="" fill sizes="(max-width: 680px) 100vw, (max-width: 1200px) 52vw, 680px"/>
      </div>
    </div>
    <ul className={`market-width ${styles.categories}`}>
      {categories.map(({value, label, photo}) => <li key={value}>
        <Link className={styles.category} href={`${catalogue}?category=${value}#material-catalogue`}>
          <svg className={styles.categoryPhoto} viewBox={photo} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
            <image href="/images/material-categories/catalogue.jpg" width="1600" height="901" />
          </svg>
          <span className={styles.categoryCopy}>
            <span><strong>{t(label)}</strong><small>{t(`${label}Description`)}</small></span>
            <span className={styles.categoryArrow}><ArrowRight size={18} aria-hidden="true"/></span>
          </span>
        </Link>
      </li>)}
    </ul>
  </section>;
}

