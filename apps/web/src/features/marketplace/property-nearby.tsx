"use client";

import Link from "next/link";
import {useEffect, useRef, useState} from "react";
import {ArrowLeft, ArrowRight, Building2, GraduationCap, Hospital, Landmark, MapPin, ShoppingBag, TrainFront, Trees, X} from "lucide-react";
import {nearbyPlaceCategories, type NearbyPlace, type PropertyNearbyPlaces} from "@the-property-pillar/contracts";
import {apiRequest} from "@/lib/api/client";
import styles from "./property-nearby.module.css";

const icons = {TRANSIT: TrainFront, SCHOOL: GraduationCap, HEALTHCARE: Hospital, SHOPPING: ShoppingBag, BANK: Landmark, PARK: Trees, WORSHIP: Building2, OTHER: MapPin};

function PlaceChip({place, id, locale, showCategory = false}: {place: NearbyPlace; id:string; locale:string; showCategory?: boolean}) {
  const Icon = icons[place.category];
  return <li><Link className={styles.chip} href={`/${locale}/properties?${new URLSearchParams({landmarkFrom:id, landmark:place.name, landmarkKind:place.category})}`}><Icon size={19} aria-hidden="true" /><span>{place.name}{showCategory && <small>{nearbyPlaceCategories[place.category]}</small>}</span></Link></li>;
}

export function PropertyNearby({id, location, locale}: {id: string; location: string; locale:string}) {
  const [result, setResult] = useState<{id: string; data: PropertyNearbyPlaces}>();
  const data = result?.id === id ? result.data : null;
  const rail = useRef<HTMLUListElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [scrollable, setScrollable] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    void apiRequest<PropertyNearbyPlaces>(`/public/properties/${encodeURIComponent(id)}/nearby`, {signal: abort.signal})
      .then((data) => {if (!abort.signal.aborted) setResult({id, data});}, () => {});
    return () => abort.abort();
  }, [id]);
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const measure = () => setScrollable(element.scrollWidth > element.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [data]);

  function scroll(direction: number) {
    const element = rail.current;
    if (!element) return;
    element.scrollBy({left: direction * (getComputedStyle(element).direction === "rtl" ? -1 : 1) * element.clientWidth * .75,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
  }

  if (!data?.places.length) return null;
  const {places, basis, city, source} = data;
  const subtitle = basis === "city" && city ? `Around ${city} city centre` : location;
  return <section className={styles.nearby} aria-label="Places nearby">
    <header><span className={styles.emblem}><MapPin size={24} aria-hidden="true" /></span>
      <div><h2>Places nearby</h2>{subtitle && <p>{subtitle}</p>}</div>
      <button type="button" className={styles.textButton} onClick={() => dialog.current?.showModal()}>View all ({places.length})</button>
    </header>
    <div className={styles.railRow}>
      {scrollable && <button type="button" className={styles.iconButton} aria-label="Previous nearby places" onClick={() => scroll(-1)}><ArrowLeft size={17} /></button>}
      <ul className={styles.rail} ref={rail}>{places.map((place, index) => <PlaceChip key={index} place={place} id={id} locale={locale} />)}</ul>
      {scrollable && <button type="button" className={styles.iconButton} aria-label="Next nearby places" onClick={() => scroll(1)}><ArrowRight size={17} /></button>}
    </div>
    <p className={styles.attribution}>{source === "osm"
      ? <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
      : <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">© GeoNames</a>}</p>
    <dialog ref={dialog} className={styles.dialog} aria-label="All nearby places">
      <header><h2>Places nearby</h2><button className={styles.iconButton} type="button" aria-label="Close nearby places" onClick={() => dialog.current?.close()}><X size={20} /></button></header>
      <ul className={styles.fullList}>{places.map((place, index) => <PlaceChip key={index} place={place} id={id} locale={locale} showCategory />)}</ul>
    </dialog>
  </section>;
}
