"use client";

import MuiButton from "@mui/material/Button";

import {useEffect, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useTranslations} from "next-intl";
import {MarketplaceBreadcrumbs} from "@/components/layout/marketplace-breadcrumbs";
import {ArrowUpRight, ChevronLeft, ChevronRight} from "lucide-react";
import {useMarketplaceAuth} from "@/features/auth/marketplace-session";
import {apiRequest} from "@/lib/api/client";
import {CompactPropertyCard, ListingGridSkeleton, type Listing} from "@/features/marketplace/directory";
import {HomeRail} from "./home-rail";
import {browserPropertyInterests, clearBrowserPropertyInterests} from "./property-interests";
import styles from "@/features/marketplace/directory.module.css";
import home from "./property-home.module.css";

type Recommendations = {items: Listing[]; page: number; total: number; pageSize: number; personalized: boolean};

export function RecommendedProperties({locale, page = 1, homepage = false}: {locale: string; page?: number; homepage?: boolean}) {
  const auth = useMarketplaceAuth();
  const t = useTranslations("Site");
  const router = useRouter();
  const [result, setResult] = useState<Recommendations | null>(null);
  const [failed, setFailed] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [retry, setRetry] = useState(0);
  const route = `/${locale}/properties/recommended`;
  useEffect(() => {
    if (auth?.state === "loading") return;
    const abort = new AbortController();
    setResult(null);
    setFailed(false);
    void apiRequest<Recommendations>("/public/properties/recommendations", {
      method: "POST", body: {page, interests: browserPropertyInterests()}, signal: abort.signal,
    }).then((result) => {if (!abort.signal.aborted) setResult(result);}, () => {if (!abort.signal.aborted) setFailed(true);});
    return () => abort.abort();
  }, [auth?.state, auth?.session, page, retry]);

  async function clear() {
    setClearing(true);
    try {
      if (auth?.session) await apiRequest("/workspace/property-interests", {method: "DELETE"});
      clearBrowserPropertyInterests();
      if (page > 1) router.replace(route);
      else setRetry((value) => value + 1);
    } catch {setFailed(true);}
    finally {setClearing(false);}
  }

  if (homepage && (failed || (result && !result.items.length))) return null;
  const pages = result ? Math.ceil(result.total / result.pageSize) : 0;
  return <section className={`${homepage ? "market-width market-featured " : ""}${home.recommendations} ${styles.listingSection}`} aria-labelledby="recommended-heading">
    {!homepage && <MarketplaceBreadcrumbs locale={locale} parent={{title: t("properties"), href: `/${locale}/properties`}} current={t("recommendedProperties")} />}
    <div className="market-featured-heading">
      {homepage ? <h2 id="recommended-heading">{t("recommendedProperties")}</h2> : <h1 id="recommended-heading">{t("recommendedProperties")}</h1>}
      {homepage ? <Link className={`${styles.secondaryButton} ${home.viewRecommendations}`} href={route}>View all recommendations <ArrowUpRight size={16} aria-hidden="true" /></Link>
        : result?.personalized && <MuiButton className={styles.secondaryButton} type="button" disabled={clearing} onClick={() => void clear()}>Clear recommendation history</MuiButton>}
    </div>
    {failed ? <p className={styles.state} role="alert">Recommendations are unavailable. <MuiButton type="button" onClick={() => setRetry((value) => value + 1)}>Retry</MuiButton></p>
      : !result ? <ListingGridSkeleton kind="properties" count={3} />
        : result.items.length ? (homepage
          ? <HomeRail label="recommended properties">{result.items.map((item) => <CompactPropertyCard key={item.id} item={item} locale={locale} />)}</HomeRail>
          : <div className={styles.grid}>{result.items.map((item) => <CompactPropertyCard key={item.id} item={item} locale={locale} />)}</div>)
          : <p className={styles.state}>No properties are available on this page.</p>}
    {!homepage && (page > 1 || page < pages) && <nav className={home.pagination} aria-label="Recommendation pages">
      {page > 1 && <Link href={page === 2 ? route : route + "?page=" + (page - 1)} className={styles.secondaryButton}><ChevronLeft size={16} aria-hidden="true" /> Previous</Link>}
      <span>Page {page}{pages ? " of " + pages : ""}</span>
      {page < pages && <Link href={route + "?page=" + (page + 1)} className={styles.secondaryButton}>Next <ChevronRight size={16} aria-hidden="true" /></Link>}
    </nav>}
  </section>;
}
