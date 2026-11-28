"use client";

import Link from "next/link";
import Image from "next/image";
import {useEffect, useState} from "react";
import {ArrowUpRight, Award, Calculator, ChartNoAxesCombined, Landmark} from "lucide-react";
import {apiRequest} from "@/lib/api/client";
import {imageSource} from "@/lib/image-source";
import {FeaturedProfileSection} from "@/features/home/featured-profile-section";
import {FeaturedDealers} from "@/features/home/home-discovery-sections";
import styles from "./property-resources.module.css";

function useFeed<T>(path:string) {
  const [response,setResponse]=useState<{path:string;items?:T[];error?:boolean}>();
  useEffect(()=>{
    const controller=new AbortController();
    apiRequest<T[]>(path,{signal:controller.signal}).then(items=>setResponse({path,items}),
      ()=>{if(!controller.signal.aborted)setResponse({path,error:true})});
    return ()=>controller.abort();
  },[path]);
  return response?.path===path?response:undefined;
}

type Featured = {id:string;role:string;verified:boolean;fullName:string;profileLogoUrl:string|null;profileLocation:string|null;path:string|null};
const audiences = [
  ["DEALER","Featured dealers"],["BUILDER","Featured builders"],["PROFESSIONAL","Featured professionals"],
  ["BLUE_COLLAR_WORKER","Featured skilled workers"],["WHITE_COLLAR_SEEKER","Featured job seekers"],
] as const;
export function FeaturedAccounts({locale}:{locale:string}) {
  const response=useFeed<Featured>("/public/featured-accounts");
  return <div className={styles.featured}><FeaturedDealers locale={locale} extra={response?.items?.filter(p=>p.role==="DEALER")} loading={!response}/>{audiences.map(([role,title])=>{
    const choices=response?.items?.filter(person=>person.role===role)??[];
    if(role==="DEALER")return null;
    if(role==="BUILDER" || role==="PROFESSIONAL"){
      const cards=choices.map(person=>({name:person.fullName,verified:person.verified,logo:imageSource(person.profileLogoUrl),
        location:person.profileLocation??undefined,href:person.path?`/${locale}/${person.path}`:undefined}));
      return <FeaturedProfileSection key={role} group={role==="BUILDER"?"builders":"professionals"} cards={cards} locale={locale}
        loading={!response} failed={response?.error}/>;
    }
    if(!choices.length && (role==="WHITE_COLLAR_SEEKER" || role==="BLUE_COLLAR_WORKER")) return null;
    return <section key={role} className={styles.section}><h2>{title}</h2>
      {choices.length ? <div className={styles.cards}>{choices.map(person=>{
        const logo=imageSource(person.profileLogoUrl);
        const content=<>{logo?<Image src={logo} alt="" unoptimized width={54} height={54}/>:<span className={styles.initial}>{person.fullName.slice(0,1)}</span>}
          <span><strong>{person.fullName}</strong>{person.profileLocation&&<small>{person.profileLocation}</small>}</span>
          <span className={styles.badge} data-shine="true"><Award size={13}/> Featured</span></>;
        return person.path?<Link key={person.id} href={"/"+locale+"/"+person.path} className={styles.person}>{content}</Link>:<article key={person.id} className={styles.person}>{content}</article>;
      })}</div>:<p>{!response?"Loading profiles…":response.error?"Profiles could not be loaded.":"No featured profiles yet."}</p>}
    </section>;
  })}</div>;
}
type Month={month:string;average:number;count:number};
export function PropertyResources({locale,id,city,currency}:{locale:string;id:string;city:string;currency:string}) {
  const response=useFeed<Month>("/public/property-rate-trends/"+encodeURIComponent(id));
  const cards=[
    {title:"EMI calculator",body:"Estimate your monthly instalment using the loan amount, interest rate and tenure.",icon:Calculator,href:"#emi-calculator"},
    {title:"Home loans",body:"Explore financing options and request a call about a home loan.",icon:Landmark,href:"/"+locale+"/finance-services"},
    {title:"Property rate trends",body:"Compare monthly asking prices per square foot for listings in this city.",icon:ChartNoAxesCombined,href:"#property-rate-trends"},
  ];
  return <section className={styles.section} aria-label="Property finance and rates"><div className={styles.cards}>{cards.map(({title,body,icon:Icon,href})=>
    <article className={styles.resource} key={title}><h3><Icon size={22}/>{title}</h3><p>{body}</p><Link href={href} onClick={()=>{if(href==="#property-rate-trends")document.querySelector<HTMLDetailsElement>(href)?.setAttribute("open","");}} aria-label={"View "+title}>View now <ArrowUpRight size={16}/></Link></article>)}</div>
    <details id="property-rate-trends" className={styles.trends} onToggle={e=>{if(e.currentTarget.open)e.currentTarget.focus()}} tabIndex={-1}>
      <summary>Property rate trends{city?" in "+city:""}</summary>
      {response?.items?.length?<table><caption>Monthly average asking price per sq ft · {currency}</caption><thead><tr><th>Month</th><th>Average</th><th>Listings</th></tr></thead><tbody>{response.items.map(row=>
        <tr key={row.month}><td>{row.month}</td><td>{row.average.toLocaleString(locale,{maximumFractionDigits:0})}</td><td>{row.count}</td></tr>)}</tbody></table>
        :<p>{!response?"Loading rates…":response.error?"Rates could not be loaded.":"There are no comparable published rates for the last 12 months."}</p>}
    </details></section>;
}
