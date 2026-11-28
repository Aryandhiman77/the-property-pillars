import Link from "next/link";
import {getTranslations} from "next-intl/server";
import {FaApple, FaFacebook, FaGooglePlay, FaInstagram, FaLinkedin, FaYoutube} from "react-icons/fa6";
import {sitePageTitles} from "@the-property-pillar/contracts";
import {BrandLogo} from "./brand-logo";
import {MobileAppSection} from "./mobile-app-section";
import {MarketplaceAccountLink} from "@/features/auth/marketplace-session";
import styles from "./marketplace-footer.module.css";

function external(value: string | undefined) {
  return value && URL.canParse(value) && new URL(value).protocol === "https:" ? value : undefined;
}
export async function MarketplaceFooter({locale}: {locale: string}) {
  const t = await getTranslations("Site");
  const editorial = await getTranslations("Articles");
  const prefix = "/" + locale;
  const quick = [
    [t("reportProblem"), "support/report"], [t("listProperty"), "post-property"], [t("properties"), "properties"],
    [t("buildingMaterials"), "materials"], [t("professionals"), "professionals"], [t("loanCalculator"), "finance-services"], [editorial("title"), "articles"], [t("jobs"), "jobs"],
  ];
  const networks = [
    {label:"Instagram", icon:FaInstagram, url:external(process.env.NEXT_PUBLIC_INSTAGRAM_URL)},
    {label:"Facebook", icon:FaFacebook, url:external(process.env.NEXT_PUBLIC_FACEBOOK_URL)},
    {label:"YouTube", icon:FaYoutube, url:external(process.env.NEXT_PUBLIC_YOUTUBE_URL)},
    {label:"LinkedIn", icon:FaLinkedin, url:external(process.env.NEXT_PUBLIC_LINKEDIN_URL)},
  ];
  const partners = [
    {label:process.env.FOOTER_PARTNER_ONE_NAME,url:external(process.env.FOOTER_PARTNER_ONE_URL)},
    {label:process.env.FOOTER_PARTNER_TWO_NAME,url:external(process.env.FOOTER_PARTNER_TWO_URL)},
  ].filter(item => item.label && item.url);
  return <><MobileAppSection locale={locale} />
    <footer className={styles.footer}><div className="market-width">
      <div className={styles.grid}>
        <nav aria-label="Quick links"><h2>Quick links</h2>{quick.map(([label,path]) =>
          <Link key={path} href={prefix + "/" + path}>{label}</Link>)}</nav>
        <nav aria-label="Company"><h2>Company</h2>
          <Link href={prefix + "/info/about"}>About us</Link><Link href={prefix + "/info/contact"}>Contact us</Link>
          <MarketplaceAccountLink locale={locale} label={t("dashboard")} /></nav>
        <nav aria-label="Legal and compliance"><h2>Legal &amp; compliance</h2>
          {Object.entries(sitePageTitles).filter(([key]) => key !== "about" && key !== "contact").map(([slug,label]) =>
            <Link key={slug} href={prefix + "/info/" + slug}>{label}</Link>)}</nav>
        <nav aria-label="Industry directory"><h2>{partners.length ? "Our partners" : "Industry directory"}</h2>
          {partners.map(partner => <a key={partner.url} href={partner.url}>{partner.label}</a>)}
          <Link href={prefix + "/dealers"}>{t("dealers")}</Link><Link href={prefix + "/projects"}>Builder projects</Link>
          <Link href={prefix + "/workers"}>{t("workers")}</Link>
        </nav>
        <div className={styles.brand}><Link href={prefix} aria-label="The Property Pillar home"><BrandLogo /></Link>
          <div className={styles.stores}>{[
            {store:"Google Play",icon: FaGooglePlay,url:external(process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL)},
            {store:"App Store",icon: FaApple,url:external(process.env.NEXT_PUBLIC_APP_STORE_URL)},
          ].map(({store,icon:Icon,url}) => {
            const badge = <><Icon aria-hidden="true"/><span><small>{url ? "Download on" : t("mobileAppUnavailable")}</small>{store}</span></>;
            return url ? <a key={store} href={url}>{badge}</a> : <span key={store}>{badge}</span>;
          })}</div>
          <div className={styles.social}>{networks.map(({label,icon:Icon,url}) => url && <a key={label} href={url} aria-label={label}><Icon aria-hidden="true"/></a>)}</div>
        </div>
      </div>
      <p className={styles.note}>{t("footerDisclaimer")} <Link href={prefix + "/info/disclaimer"}>Read the marketplace disclaimer</Link></p>
      <p className={styles.copyright}>© {new Date().getFullYear()} The Property Pillar · <a href="https://www.geonames.org/" rel="noreferrer">GeoNames</a> · <a href="https://www.magnific.com/free-photo/modern-blocks-apartment-formwork-construction_1046010.htm">Building materials photo by evening_tao / Magnific</a></p>
    </div></footer></>;
}
