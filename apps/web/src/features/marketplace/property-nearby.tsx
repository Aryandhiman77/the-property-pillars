"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import {Building2, GraduationCap, Hospital, Landmark, MapPin, ShoppingBag, TrainFront, Trees} from "lucide-react";
import {nearbyPlaceCategories, type NearbyPlace, type PropertyNearbyPlaces} from "@the-property-pillar/contracts";
import {apiRequest} from "@/lib/api/client";
import styles from "./property-nearby.module.css";

const icons = {TRANSIT: TrainFront, SCHOOL: GraduationCap, HEALTHCARE: Hospital, SHOPPING: ShoppingBag, BANK: Landmark, PARK: Trees, WORSHIP: Building2, OTHER: MapPin};

function PlaceChip({place, id, locale}: {place: NearbyPlace; id:string; locale:string}) {
  const Icon = icons[place.category];
  return <li><Link className={styles.chip} title={nearbyPlaceCategories[place.category]} href={`/${locale}/properties?${new URLSearchParams({landmarkFrom:id, landmark:place.name, landmarkKind:place.category})}`}><Icon size={19} aria-hidden="true" /><span>{place.name}</span></Link></li>;
}

export function PropertyNearby({id, location, locale}: {id: string; location: string; locale:string}) {
  const [result, setResult] = useState<{id: string; data: PropertyNearbyPlaces}>();
  const data = result?.id === id ? result.data : null;
  useEffect(() => {
    const abort = new AbortController();
    void apiRequest<PropertyNearbyPlaces>(`/public/properties/${encodeURIComponent(id)}/nearby`, {signal: abort.signal})
      .then((data) => {if (!abort.signal.aborted) setResult({id, data});}, () => {});
    return () => abort.abort();
  }, [id]);
  if (!data?.places.length) return null;
  const {places, basis, city, source} = data;
  const subtitle = basis === "city" && city ? `Around ${city} city centre` : location;
  return <section className={styles.nearby} aria-label="Places nearby">
    <header><span className={styles.emblem}><MapPin size={24} aria-hidden="true" /></span>
      <div><h2>Places nearby</h2>{subtitle && <p>{subtitle}</p>}</div>
    </header>
    <ul className={styles.places}>
      {places.map((place, index) => <PlaceChip key={index} place={place} id={id} locale={locale} />)}
    </ul>
    <p className={styles.attribution}>{source === "osm"
      ? <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
      : <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">© GeoNames</a>}</p>
  </section>;
}
