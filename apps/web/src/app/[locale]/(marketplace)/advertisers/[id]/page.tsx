import {setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {isAppLocale} from "@/i18n/config";
import {MarketplaceShell, MarketplaceBreadcrumbs} from "@/features/marketplace/marketplace-shell";
import {AdvertiserProfile} from "@/features/marketplace/advertiser-profile";

export default async function AdvertiserPage({params}: {params: Promise<{locale:string; id:string}>}) {
  const {locale,id} = await params;
  if (!isAppLocale(locale) || id.length > 160) notFound();
  setRequestLocale(locale);
  return <MarketplaceShell>
    <MarketplaceBreadcrumbs locale={locale} parent={{title:"Properties",href:"/" + locale + "/properties"}} current="Advertiser profile" />
    <AdvertiserProfile key={id} id={id} locale={locale} />
  </MarketplaceShell>;
}
