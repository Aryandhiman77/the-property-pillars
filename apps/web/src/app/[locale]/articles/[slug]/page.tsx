import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {isAppLocale, locales} from "@/i18n/config";
import {ArticleReader} from "@/features/articles/article-reader";
import {publicArticleRequest} from "@/features/articles/article-api";
import {MarketplaceBreadcrumbs, MarketplaceShell} from "@/features/marketplace/marketplace-shell";
import type {ArticleDetails} from "@/features/articles/types";

export const dynamic = "force-dynamic";

type Props = {params: Promise<{locale: string; slug: string}>};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale, slug} = await params;
  if (!isAppLocale(locale) || !/^[a-z0-9-]{1,110}$/.test(slug)) return {};
  const data = await publicArticleRequest<ArticleDetails>(`/${slug}?locale=${locale}`).catch(() => null);
  if (!data) return {};
  const {article} = data;
  const url = `/${locale}/articles/${slug}`;
  return {
    title: article.title, description: article.summary,
    alternates: {canonical: url, languages: Object.fromEntries(locales.map((lang) => [lang, `/${lang}/articles/${slug}`]))},
    openGraph: {type: "article", title: article.title, description: article.summary, url, images: [{url: article.coverImage, alt: article.imageAlt}], publishedTime: article.publishedAt},
  };
}

export default async function ArticleDetailPage({params}: Props) {
  const {locale, slug} = await params;
  if (!isAppLocale(locale) || !/^[a-z0-9-]{1,110}$/.test(slug)) notFound();
  setRequestLocale(locale);
  const [data, t] = await Promise.all([publicArticleRequest<ArticleDetails>(`/${slug}?locale=${locale}`).catch(() => undefined), getTranslations("Articles")]);
  if (data === null) notFound();
  return <MarketplaceShell locale={locale} articleReader>
    <MarketplaceBreadcrumbs locale={locale} parent={{title: t("title"), href: `/${locale}/articles`}} current={data?.article.title ?? t("title")} />
    {data ? <ArticleReader initial={data} locale={locale} key={`${locale}:${slug}`} /> : <p role="status">{t("actionFailed")}</p>}
  </MarketplaceShell>;
}
