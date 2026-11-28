import {LoadingRows} from "@/components/ui/loading-skeleton";
import {cache, Suspense} from "react";
import Link from "next/link";
import {notFound} from "next/navigation";
import {setRequestLocale} from "next-intl/server";
import {isSitePageSlug, sitePageTitles, type SitePage} from "@the-property-pillar/contracts";
import {isAppLocale} from "@/i18n/config";
import {MarketplaceBreadcrumbs, MarketplaceShell} from "@/features/marketplace/marketplace-shell";
import {ContactForm} from "@/features/site-pages/contact-form";
import styles from "@/features/site-pages/pages.module.css";

type Params = Promise<{locale: string; slug: string}>;
const read = cache(async (slug: string) => {
  if (!isSitePageSlug(slug)) notFound();
  const base = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000";
  const res = await fetch(new URL("/api/v1/public/site-pages/" + slug, base), {cache:"no-store", signal: AbortSignal.timeout(12000)});
  if (!res.ok) throw new Error("Could not load this page.");
  return (await res.json() as {data: SitePage}).data;
});
export async function generateMetadata({params}: {params: Params}) {
  const {slug} = await params;
  return {title: (await read(slug)).title + " | The Property Pillar"};
}
export default async function InfoPage({params}: {params: Params}) {
  const {locale,slug} = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  if (!isSitePageSlug(slug)) notFound();
  return <MarketplaceShell><Suspense fallback={<LoadingRows label={"Loading " + sitePageTitles[slug]} count={5}/>}>
    <InfoContent locale={locale} slug={slug}/>
  </Suspense></MarketplaceShell>;
}

async function InfoContent({locale,slug}:{locale:string;slug:string}) {
  const page = await read(slug);
  return <>
    <MarketplaceBreadcrumbs locale={locale} current={page.title} />
    <header className={styles.heading}><h1>{page.title}</h1></header>
    <div className={styles.readingLayout}>
      <article className={styles.body}>{slug==="contact" && <ContactForm/>}<div dangerouslySetInnerHTML={{__html: page.body}} />
        {slug!=="contact" && <Link className={styles.support} href={`/${locale}/support/report`}>Contact support ↗</Link>}
      </article>
      <nav className={styles.related} aria-label="Company and policy pages">{Object.entries(sitePageTitles).map(([key,title]) =>
        <Link key={key} href={`/${locale}/info/${key}`} aria-current={slug === key ? "page" : undefined}>{title}</Link>)}</nav>
    </div>
  </>;
}
