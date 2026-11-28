import Image from "next/image";
import Link from "next/link";
import {ArrowRight} from "lucide-react";
import {getTranslations} from "next-intl/server";
import {publicTaskHref} from "@/config/public-tasks";
import styles from "./building-materials.module.css";

const categories = [
  {value: "CEMENT", label: "cement", credit: "jannoon028", source: "https://www.magnific.com/free-photo/brick-wall-with-fresh-cement_985359.htm"},
  {value: "TMT_STEEL", label: "steel", credit: "jcomp", source: "https://www.magnific.com/free-photo/steel-bar-site-construction_4550480.htm"},
  {value: "BRICKS_BLOCKS", label: "bricks", credit: "Magnific", source: "https://www.magnific.com/free-photo/exposed-bricks-wall_6415107.htm"},
  {value: "TILES", label: "tiles", credit: "mrsiraphol", source: "https://www.magnific.com/free-photo/wall-stone-block-slab-tile_1043903.htm"},
  {value: "PAINTS", label: "paints", credit: "Magnific", source: "https://www.magnific.com/free-photo/painting-cans-brushes_9639364.htm"},
  {value: "ELECTRICALS", label: "electrical", credit: "pvproductions", source: "https://www.magnific.com/free-photo/electrician-working-switchboard-electrical-component-setup-cable-connection_418919133.htm"},
] as const;

export async function BuildingMaterials({locale}: {locale: string}) {
  const [t, site] = await Promise.all([getTranslations("BuildingMaterials"), getTranslations("Site")]);
  const catalogue = `/${locale}/materials`;
  return <section id="building-materials" className={`market-architecture-backdrop ${styles.section}`} aria-labelledby="building-materials-heading">
    <div className={`market-width ${styles.banner}`}>
      <div className={styles.copy}>
        <h2 id="building-materials-heading">{site("buildingMaterials")}</h2>
        <p>{t("description")}</p>
        <div className={styles.actions}>
          <Link href={catalogue} className={styles.browse}>{t("browse")} <ArrowRight size={19} aria-hidden="true"/></Link>
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
      {categories.map(({value, label}) => <li key={value}>
        <Link className={styles.category} href={`${catalogue}?category=${value}`}>
          <Image alt="" fill src={`/images/material-categories/${label}.webp`} sizes="(max-width: 520px) 92vw, (max-width: 980px) 46vw, 390px"/>
          <span className={styles.categoryCopy}>
            <span><strong>{t(label)}</strong><small>{t(`${label}Description`)}</small></span>
            <span className={styles.categoryArrow}><ArrowRight size={18} aria-hidden="true"/></span>
          </span>
        </Link>
      </li>)}
    </ul>
    <details className={`market-width ${styles.credits}`}>
      <summary>{t("photoCredits")}</summary>
      <ul>{categories.map(({label, credit, source}) =>
        <li key={label}><a href={source}>{t(label)} · {credit} / Magnific</a></li>)}</ul>
    </details>
  </section>;
}

