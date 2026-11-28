"use client";

import Button from "@mui/material/Button";
import {BadgeCheck, CalendarDays, Heart, House, Landmark, MessagesSquare} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {useEffect, useState, type ReactNode} from "react";
import {isUploadedVideoUrl, propertyGalleryUrls} from "@the-property-pillar/contracts";
import {apiRequest} from "@/lib/api/client";
import {imageSource} from "@/lib/image-source";
import {Skeleton} from "@/components/ui/loading-skeleton";
import {PropertyContact} from "@/features/marketplace/property-contact";
import {compactPropertyPrice} from "@/features/marketplace/listing-price";
import type {WorkspaceCollection, WorkspaceItem} from "./types";
import styles from "./buyer-overview.module.css";

export function buyerSummary(collections: WorkspaceCollection[], now: Date) {
  const items = (key: string) => collections.find(c => c.key === key)?.items ?? [];
  const saved = items("savedProperties").filter(item => item.status === "ACTIVE");
  const enquiries = items("propertyInquiries").filter(item => ["NEW", "CONTACTED", "SITE_VISIT_SCHEDULED", "NEGOTIATING"].includes(item.status));
  const visits = enquiries.filter(item => {
    const scheduled = item.status === "SITE_VISIT_SCHEDULED";
    if (!scheduled && item.data.inquiryType !== "SITE_VISIT") return false;
    const date = Date.parse(String(item.data.preferredVisitAt ?? ""));
    return Number.isFinite(date) ? date >= now.getTime() : scheduled;
  }).sort((a, b) => (Date.parse(String(a.data.preferredVisitAt)) || Infinity) - (Date.parse(String(b.data.preferredVisitAt)) || Infinity));
  const loans = items("loanInquiries");
  return {saved, visits, enquiries, loans};
}
type Summary = ReturnType<typeof buyerSummary>;
type BuyerProps = {summary: Summary; name: string; locale: string; onView: (view: string) => void};

export function BuyerIdentity({summary, name, avatar, ready, onView, close}: Omit<BuyerProps, "locale"> & {
  avatar: ReactNode; ready: boolean; close: ReactNode;
}) {
  const [profile, setProfile] = useState<{location?: string; phoneVerifiedAt?: string; emailVerifiedAt?: string}>();
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<NonNullable<typeof profile>>("/account/profile", {signal: controller.signal})
      .then(value => {if (!controller.signal.aborted) setProfile(value);}).catch(() => {});
    return () => controller.abort();
  }, []);
  return <section className={styles.identity}>
    <div className={styles.identityTop}>
      <button type="button" className={styles.person} onClick={() => onView("profile")}>
        <span className={styles.avatar}>{avatar}</span>
        <span><strong>{name}</strong><small>Buyer / Tenant{profile?.location && " · " + profile.location}</small></span>
      </button>{close}
    </div>
    {(profile?.phoneVerifiedAt || profile?.emailVerifiedAt) && <div className={styles.badges}>
      {profile.phoneVerifiedAt && <span><BadgeCheck size={13} /> Mobile verified</span>}
      {profile.emailVerifiedAt && <span><BadgeCheck size={13} /> Email verified</span>}
    </div>}
    <div className={styles.miniStats}>{[
      ["Saved", summary.saved.length, "savedProperties"], ["Visits", summary.visits.length, "visits"], ["Loans", summary.loans.length, "loanInquiries"],
    ].map(([label, count, view]) => <button type="button" key={view} onClick={() => onView(String(view))}><strong>{ready ? count : "—"}</strong>{label}</button>)}</div>
  </section>;
}

function ShortlistedHome({item, locale}: {item: WorkspaceItem; locale: string}) {
  const propertyId = typeof item.data.propertyId === "string" ? item.data.propertyId : "";
  const [listing, setListing] = useState<WorkspaceItem | null>();
  useEffect(() => {
    if (!propertyId) return;
    const controller = new AbortController();
    apiRequest<WorkspaceItem[]>("/public/properties?item=" + encodeURIComponent(propertyId), {signal: controller.signal})
      .then(items => {if (!controller.signal.aborted) setListing(items.find(home => home.id === propertyId) ?? null);})
      .catch(() => {});
    return () => controller.abort();
  }, [propertyId]);
  const data = listing?.data ?? {};
  const photo = propertyGalleryUrls(data).filter(url => !isUploadedVideoUrl(url)).map(imageSource).find(Boolean);
  const href = "/" + locale + "/properties/" + encodeURIComponent(propertyId);
  const price = listing && compactPropertyPrice(listing, locale);
  const amount = typeof data.price === "number" && data.priceMode !== "ON_REQUEST" ? data.price : undefined;
  return <li className={styles.home}>
    <div className={styles.thumb}>{photo ? <Image src={photo} alt="" fill sizes="100px" unoptimized /> : listing
      ? <PropertyContact id={propertyId} locale={locale} photos />
      : listing === undefined && propertyId ? <Skeleton className={styles.thumbSkeleton}/> : <House size={26} />}</div>
    <div>
      {(data.reraNumber || price) ? <div className={styles.meta}>{Boolean(data.reraNumber) && <span className={styles.tag}>RERA listed</span>} {price}</div> : null}
      <h3>{listing?.title ?? item.title}</h3>
      <p>{[data.locality, data.city].filter(value => typeof value === "string" && value).join(" · ")}</p>
      {propertyId && listing !== null ? <div className={styles.links}>
        <Button component={Link} size="small" href={href}>View property</Button>
        {data.listingIntent === "SALE" && amount && amount > 0 ? <Button component={Link} size="small" href={`/${locale}/finance-services?amount=${amount}&currency=${encodeURIComponent(String(data.currency ?? "INR"))}#emi-calculator`}>Check EMI</Button> : null}
      </div> : <small>Listing unavailable</small>}
    </div>
  </li>;
}

export function BuyerOverview({summary, name, locale, onView, onVisit}: BuyerProps & {onVisit: (item: WorkspaceItem) => void}) {
  const {saved, visits, enquiries, loans} = summary;
  const latestLoan = loans[0];
  const requested = latestLoan && compactPropertyPrice({data: {price: latestLoan.data.loanAmount, currency: latestLoan.data.currency}}, locale);
  const loanStatus = latestLoan?.status.toLowerCase().replaceAll("_", " ");
  const dateFormat = new Intl.DateTimeFormat(locale, {month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"});
  const browse = "/" + locale + "/properties?intent=SALE&segment=RESIDENTIAL&rera=1";
  const finance = "/" + locale + "/finance-services";
  const metrics = [
    {label: "Saved homes", value: saved.length, caption: "On your shortlist", icon: Heart, view: "savedProperties"},
    {label: "Site visits", value: visits.length, caption: "Upcoming visits and requests", icon: CalendarDays, view: "visits"},
    {label: "Property enquiries", value: enquiries.length, caption: "Open conversations", icon: MessagesSquare, view: "propertyInquiries"},
    {label: "Home loans", value: requested || loans.length, caption: requested ? "Latest amount requested" : "Loan enquiries", icon: Landmark, view: "loanInquiries"},
  ];
  return <div className={styles.overview}>
    <section className={styles.welcome}>
      <div><small>Buyer command center</small><h1>Welcome back, {name}</h1><p>Track your shortlisted homes, upcoming visits and home loan enquiries.</p></div>
      <div className={styles.actions}><Button component={Link} href={finance + "#bank-offers"}>Check loan rates</Button><Button component={Link} href={browse}>Browse RERA homes</Button></div>
    </section>
    <div className={styles.metrics}>{metrics.map(({label, value, caption, icon: Icon, view}) =>
      <button type="button" className={styles.metric} key={view} onClick={() => onView(view)}>
        <span>{label}<Icon size={17} aria-hidden="true" /></span><strong>{value}</strong><small>{caption}</small>
      </button>)}</div>
    <div className={styles.panels}>
      <section className={styles.panel}>
        <header><h2>Shortlisted properties</h2><button onClick={() => onView("savedProperties")}>View all ({saved.length})</button></header>
        {saved.length ? <ul>{saved.slice(0, 3).map(item => <ShortlistedHome key={item.id} item={item} locale={locale} />)}</ul> :
          <div className={styles.empty}><Heart size={25} /><h3>Your shortlist is empty</h3><p>Tap the heart on a home you like to save it here.</p><Link href={`/${locale}/properties`}>Browse properties</Link></div>}
      </section>
      <section className={styles.panel}>
        <header><h2>Upcoming site visits</h2><button onClick={() => onView("visits")}>Manage visits</button></header>
        {visits.length ? <ul>{visits.slice(0, 3).map(item => {
          const time = Date.parse(String(item.data.preferredVisitAt));
          const date = Number.isFinite(time) ? new Date(time) : null;
          return <li className={styles.visit} key={item.id}>
            <span className={styles.calendar}>{date ? <><small>{date.toLocaleString(locale, {month: "short"})}</small>{date.getDate()}</> : <CalendarDays size={20} />}</span>
            <div><h3>{item.title}</h3><p>{date ? dateFormat.format(date) : "Date to be arranged"}</p>
              <span className={styles.tag}>{item.status === "SITE_VISIT_SCHEDULED" ? "Scheduled" : "Visit requested"}</span></div>
            <button onClick={() => onVisit(item)}>Details</button>
          </li>;
        })}</ul> : <div className={styles.empty}><CalendarDays size={25} /><h3>No upcoming visits</h3><p>Request a site visit from a property listing. You can follow its status here.</p></div>}
        {latestLoan ? <button type="button" className={styles.loanLink} onClick={() => onView("loanInquiries")}>
          <Landmark size={17} />Latest loan enquiry · {loanStatus}<span>View</span>
        </button> : <Link className={styles.loanLink} href={finance + "#eligibility"}><Landmark size={17} /> Check home loan eligibility <span aria-hidden="true">↗</span></Link>}
      </section>
    </div>
  </div>;
}
