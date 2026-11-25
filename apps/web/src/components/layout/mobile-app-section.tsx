import {Bell, CalendarDays, Heart, Search, Smartphone} from "lucide-react";
import {FaApple, FaGooglePlay} from "react-icons/fa6";
import Image from "next/image";
import Link from "next/link";
import {getTranslations} from "next-intl/server";
import {MobileAppReveal} from "./mobile-app-reveal";
import styles from "./mobile-app-section.module.css";

export async function MobileAppSection({locale}: {locale: string}) {
  const t = await getTranslations("Site");
  const platforms = [
    {name: "Android", store: "Google Play", Icon: FaGooglePlay, url: process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL},
    {name: "iOS", store: "App Store", Icon: FaApple, url: process.env.NEXT_PUBLIC_APP_STORE_URL},
  ];
  const features = [
    {Icon: Search, title: t("appSearch"), detail: t("appSearchHint")},
    {Icon: Heart, title: t("appFavourites"), detail: t("appSavedHint")},
    {Icon: Bell, title: t("appUpdates"), detail: t("appAlertsHint")},
    {Icon: CalendarDays, title: t("appVisits"), detail: t("appVisitsHint")},
  ];
  return <section id="mobile-app" aria-labelledby="mobile-app-title" className={styles.section}>
    <MobileAppReveal>
      <div className={styles.copy}>
        <span className={styles.tag}><Smartphone size={17} aria-hidden="true" />{t("appBadge")}</span>
        <h2 id="mobile-app-title">{t.rich("mobileAppTitle", {line: text => <span>{text}</span>})}</h2>
        <p>{t("mobileAppDescription")}</p>
        <ul className={styles.features}>
          {features.map(({Icon, title, detail}) => <li key={title}>
            <span className={styles.tile}><Icon aria-hidden="true" /></span>
            <div><strong>{title}</strong><small>{detail}</small></div>
          </li>)}
        </ul>
        <div className={styles.actions}>
          <ul className={styles.stores}>
            {platforms.map(({name, store, Icon, url}) => {
              const badge = <><Icon aria-hidden="true" /><span><small>{url ? name : t("mobileAppUnavailable")}</small><strong>{store}</strong></span></>;
              return <li key={name}>{url ? <a className={styles.badge} href={url} aria-label={name + " · " + store}>{badge}</a> : <span className={styles.badge}>{badge}</span>}</li>;
            })}
          </ul>
          <Link className={styles.scan} href={`/${locale}/properties`}>
            <Image src="/images/banners/browse-properties-qr.png" alt="" width={62} height={62} unoptimized />
            <span>{t("appScan")}</span>
          </Link>
        </div>
      </div>
      <div className={styles.phoneFrame}>
        <Image className={styles.phones} src="/images/banners/mobile-app-phones.webp" width={1043} height={1170}
          sizes="(max-width: 720px) 88vw, (min-width: 1700px) 655px, 39vw" alt="" />
      </div>
    </MobileAppReveal>
  </section>;
}
