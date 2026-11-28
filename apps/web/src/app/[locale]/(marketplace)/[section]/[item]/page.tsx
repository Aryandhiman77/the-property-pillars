import {Suspense} from "react";
import {LoadingRows} from "@/components/ui/loading-skeleton";
import {ProjectPage} from "@/features/projects/public-pages";
import {detail as projectDetail} from "@/features/projects/public-data";
import type {Metadata} from "next";
import {cookies,headers} from "next/headers";
import Link from "next/link";
import {setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {isDirectory} from "@/config/marketplace";
import {isPublicTask, publicTaskHref} from "@/config/public-tasks";
import {MarketplaceDirectory} from "@/features/marketplace/directory";
import {MarketplaceShell} from "@/features/marketplace/marketplace-shell";
import {PublicTaskPage, type TaskSearchParams} from "@/features/marketplace/public-task-page";
import {isAppLocale} from "@/i18n/config";

export async function generateMetadata({params}:{params:Promise<{locale:string;section:string;item:string}>}):Promise<Metadata>{
  const {locale,section,item}=await params;
  if(section==="projects"&&item!=="new"&&item.length<=160){const p=await projectDetail(item);return {title:[p.name,p.cityName].filter(Boolean).join(" · "),description:p.shortDescription||undefined,alternates:{canonical:`/${locale}/projects/${p.slug}`}};}
  if(section!=="properties"||item.length>120)return {};
  const host=(await headers()).get("host")?.split(":")[0];
  const uat=process.env.NODE_ENV==="development"&&["127.0.0.1","localhost"].includes(host??"")&&(await cookies()).get("tpp_uat_mode")?.value==="1";
  const backend=uat?"http://127.0.0.1:4021":process.env.API_PROXY_TARGET??"http://127.0.0.1:4000";
  try{
    const url=new URL("/api/v1/public/properties",backend);url.search=new URLSearchParams({item,limit:"1"}).toString();
    const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(5000)});
    if(!response.ok)return {};
    const result=await response.json() as {data:{title:string;description?:string;data:Record<string,unknown>}[]};
    const listing=result.data[0];if(!listing)return {robots:{index:false,follow:false}};
    const info=listing.data;
    const summary=[typeof info.bedrooms==="number"?info.bedrooms+" bedrooms":"",String(info.propertyType??"").replaceAll("_"," ").toLowerCase(),info.listingIntent==="RENT"?"for rent":info.listingIntent==="LEASE"?"for lease":"for sale",info.locality,info.city].filter(Boolean).join(" · ");
    return {title:listing.title,description:[summary,listing.description].filter(Boolean).join(". ").slice(0,170)};
  }catch{return {}}
}

export default async function DirectoryItemPage({params, searchParams}: {params: Promise<{locale: string; section: string; item: string}>; searchParams: Promise<TaskSearchParams>}) {
  const {locale, section, item} = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const path = `${section}/${item}`;
  if (isPublicTask(path)) return <PublicTaskPage locale={locale} path={path} query={await searchParams} />;
  if(section==="projects"&&item.length<=160)return <MarketplaceShell><Suspense fallback={<LoadingRows label="Loading project details" count={5}/>}><ProjectPage locale={locale} slug={item} query={await searchParams}/></Suspense></MarketplaceShell>;
  const collection = section === "dealer" ? "dealers" : section;
  if (!isDirectory(collection) || item.length > 120) notFound();
  return (
    <MarketplaceShell>
      <MarketplaceDirectory kind={collection} locale={locale} selected={item} initialCity="" initialIntent="" />
      {collection === "dealers" && <p className="market-footer-note">Powered by ThePropertyPillar.com. <Link className="market-text-link" href={publicTaskHref(locale, "dealers/register")}>Create your dealer website</Link></p>}
    </MarketplaceShell>
  );
}
