import Link from "next/link";
import {getTranslations} from "next-intl/server";
import {BrandLogo} from "./brand-logo";
import {MarketplaceAccountLink} from "@/features/auth/marketplace-session";
import {publicTaskHref} from "@/config/public-tasks";

export async function MarketplaceFooter({locale}: {locale: string}) {
  const t = await getTranslations("Site");
  const editorial = await getTranslations("Articles");
  return (
    <footer className="market-footer">
      <div className="market-width market-footer-grid">
        <div className="market-footer-brand">
          <Link className="market-brand" href={"/" + locale}><BrandLogo /></Link>
          <p>{t("footerTagline")}</p>
        </div>
        <div className="market-footer-links">
          <nav aria-label={t("marketplace")}>
            <h2>{t("marketplace")}</h2>
            <Link href={"/" + locale + "/properties"}>{t("properties")}</Link>
            <Link href={"/" + locale + "/materials"}>{t("materials")}</Link>
            <Link href={"/" + locale + "/professionals"}>{t("professionals")}</Link>
            <Link href={"/" + locale + "/jobs"}>{t("jobs")}</Link>
          </nav>
          <nav aria-label={t("resources")}>
            <h2>{t("resources")}</h2>
            <Link href={"/" + locale + "/dealers"}>{t("dealers")}</Link>
            <Link href={"/" + locale + "/workers"}>{t("workers")}</Link>
            <Link href={"/" + locale + "/finance-services"}>{t("loanCalculator")}</Link>
            <Link href={`/${locale}/articles`}>{editorial("title")}</Link>
            <Link href={publicTaskHref(locale, "support/report")}>{t("reportProblem")}</Link>
            <MarketplaceAccountLink locale={locale} label={t("dashboard")} />
          </nav>
        </div>
      </div>
      <p className="market-width market-footer-note">{t("footerDisclaimer")} · <a href="https://www.geonames.org/" rel="noreferrer">© GeoNames</a></p>
    </footer>
  );
}
