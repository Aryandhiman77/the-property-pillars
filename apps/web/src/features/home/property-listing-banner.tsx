import Link from "next/link";
import {ArrowRight} from "lucide-react";
import Image from "next/image";
import {getTranslations} from "next-intl/server";
import {propertyListingHref} from "@/config/marketplace";
import styles from "./property-listing-banner.module.css";

export async function PropertyListingBanner({locale}: {locale: string}) {
  const t = await getTranslations("Site");
  return <section className={styles.banner} id="list-your-property" aria-labelledby="home-listing-title">
    <div className={styles.photo}>
      <Image src="/images/daylight/banners/projects.webp" alt="" fill sizes="(max-width: 580px) 100vw, 67vw" />
    </div>
    <div className={`market-width ${styles.inner}`}>
      <div className={styles.copy}>
        <p className={styles.audience}>{t("listingAudience")}</p>
        <h2 id="home-listing-title">{t("sellRent")}</h2>
        <p className={styles.description}>{t("sellerDescription")}</p>
      </div>
      <div className={styles.actions}>
        <Link href={propertyListingHref(locale, "RESIDENTIAL")}>
          {t("listResidential")}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link href={propertyListingHref(locale, "COMMERCIAL")}>
          {t("listCommercial")}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </div>
  </section>;
}
