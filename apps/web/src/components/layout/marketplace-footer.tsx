import Link from "next/link";
import {BrandLogo} from "./brand-logo";
import {MarketplaceAccountLink} from "@/features/auth/marketplace-session";
import {publicTaskHref} from "@/config/public-tasks";

export function MarketplaceFooter({locale, tagline, disclaimer}: {
  locale: string;
  tagline: string;
  disclaimer: string;
}) {
  return (
    <footer className="market-footer">
      <div className="market-width market-footer-grid">
        <div className="market-footer-brand">
          <Link className="market-brand" href={"/" + locale}><BrandLogo /></Link>
          <p>{tagline}</p>
        </div>
        <div className="market-footer-links">
          <nav aria-label="Marketplace links">
            <h2>Marketplace</h2>
            <Link href={"/" + locale + "/properties"}>Properties</Link>
            <Link href={"/" + locale + "/materials"}>Materials</Link>
            <Link href={"/" + locale + "/professionals"}>Professionals</Link>
            <Link href={"/" + locale + "/jobs"}>Jobs</Link>
          </nav>
          <nav aria-label="Resources">
            <h2>Resources</h2>
            <Link href={"/" + locale + "/dealers"}>Find a dealer</Link>
            <Link href={"/" + locale + "/workers"}>Find workers</Link>
            <Link href={"/" + locale + "/finance-services"}>Loan calculator</Link>
            <Link href={publicTaskHref(locale, "support/report")}>Report a problem</Link>
            <MarketplaceAccountLink locale={locale} label="Open dashboard" />
          </nav>
        </div>
      </div>
      <p className="market-width market-footer-note">{disclaimer}</p>
    </footer>
  );
}
