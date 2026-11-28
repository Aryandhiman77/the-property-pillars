"use client";

import Image from "next/image";
import Link from "next/link";
import {ArrowUpRight, BadgeCheck, Building2, DraftingCompass, House, MapPin, Star} from "lucide-react";
import {useTranslations} from "next-intl";
import {HomeRail} from "./home-rail";
import styles from "./featured-profile-section.module.css";

const groups = {
  dealers: {title:"Featured dealers", browse:"Browse dealers", path:"dealers", icon:House, cover:"/images/daylight/banners/dealers.webp"},
  builders: {title:"Featured builders", browse:"Browse projects", path:"projects", icon:Building2, cover:"/images/daylight/banners/projects.webp"},
  professionals: {title:"Featured professionals", browse:"Browse professionals", path:"professionals", icon:DraftingCompass, cover:"/images/daylight/banners/professionals.webp"},
};
type Group = keyof typeof groups;
export type FeaturedCard = {
  name:string; verified?:boolean; location?:string; specialty?:string; detail?:string; cover?:string; logo?:string;
  href?:string; listingsHref?:string; contactHref?:string; membership?:string; activity?:string;
};

export function FeaturedProfileSection({group, locale, cards, loading, failed}:{
  group:Group; locale:string; cards:FeaturedCard[]; loading:boolean; failed?:boolean;
}) {
  const {title,browse,path,icon:Icon,cover}=groups[group];
  const t=useTranslations("Articles");
  return <section id={"featured-"+group} aria-labelledby={"featured-"+group+"-title"} className={styles.group} data-group={group}>
    <header className={styles.heading}>
      <div className={styles.title}><span className={styles.icon}><Icon size={22} aria-hidden="true"/></span>
        <h2 id={"featured-"+group+"-title"}>{title}</h2></div>
      <Link href={`/${locale}/${path}`} className={styles.browse}>{browse}<ArrowUpRight size={16}/></Link>
    </header>
    {cards.length>0 ? <HomeRail label={title.toLowerCase()} className={styles.rail}>
      {cards.map(card=>{
        const initials=card.name.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join("");
        return <article key={card.href ?? card.name} className={styles.card}>
          <div className={styles.cover}><Image src={card.cover || cover} fill sizes="(max-width:600px) 84vw,(max-width:960px) 48vw,400px" alt="" unoptimized={Boolean(card.cover && !card.cover.startsWith("/images/"))}/>
            <span className={styles.badge} data-shine="true"><Star size={12} fill="currentColor" aria-hidden="true"/>Featured</span>
            {group==="builders" && <span className={styles.premium} data-shine="true">Premium</span>}
          </div>
          <div className={styles.body}>
            <span className={styles.logo} aria-hidden="true">{card.logo?<Image src={card.logo} width={50} height={50} unoptimized alt=""/>:initials}</span>
            <h3>{card.href?<Link href={card.href}>{card.name}</Link>:card.name} {card.verified && <BadgeCheck className="market-verified" size={16} aria-label="Verified profile"/>}</h3>
            {card.specialty && <p>{card.specialty}</p>}
            {card.membership && <small>{card.membership}</small>}{card.activity && <small>{card.activity}</small>}
          </div>
          {(card.location||card.detail) && <footer className={styles.meta}>
            {card.location && <span><MapPin size={15} aria-hidden="true"/>{card.location}</span>}
            {card.detail && (card.listingsHref?<Link href={card.listingsHref}>{card.detail} <ArrowUpRight size={14}/></Link>:<span>{card.detail}</span>)}
          </footer>}
          {card.contactHref && <Link className={styles.contact} href={card.contactHref}>{t("contactDealer")} <ArrowUpRight size={14}/></Link>}
        </article>;
      })}
    </HomeRail> : <p className={styles.empty} role="status">{loading?"Loading profiles…":failed?"Profiles could not be loaded.":"No featured profiles yet."}</p>}
  </section>;
}
