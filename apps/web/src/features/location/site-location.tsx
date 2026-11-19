"use client";

import {createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode} from "react";
import {ChevronDown, LocateFixed, MapPin, Search} from "lucide-react";
import {useRouter} from "next/navigation";
import {countryName, listingCountries} from "@/config/listing-geography";

type Place = {area: string; city: string; state: string; countryCode?: string};
type Status = "idle" | "loading" | "ready" | "denied" | "unavailable";
const cacheKey = "tpp-site-location";
const LocationContext = createContext<{place: Place | null; status: Status; locate: () => void}>({
  place: null, status: "idle", locate: () => {},
});

function text(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

export function SiteLocationProvider({children}: {children: ReactNode}) {
  const [place, setPlace] = useState<Place | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const started = useRef(false);
  const pending = useRef(false);

  const locate = useCallback(() => {
    if (pending.current) return;
    if (!navigator.geolocation || !window.isSecureContext) {
      setStatus("unavailable");
      return;
    }
    pending.current = true;
    setStatus("loading");
    const finish = (next: Status, nearby: Place | null = null) => {
      pending.current = false;
      setPlace(nearby);
      setStatus(next);
      try { sessionStorage.setItem(cacheKey, JSON.stringify({status: next, place: nearby})); } catch {}
    };
    navigator.geolocation.getCurrentPosition(async ({coords}) => {
      try {
        const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
        url.search = new URLSearchParams({
          latitude: String(coords.latitude), longitude: String(coords.longitude), localityLanguage: "en",
        }).toString();
        const response = await fetch(url, {signal: AbortSignal.timeout(8000), referrerPolicy: "no-referrer"});
        if (!response.ok) throw new Error("Location is unavailable.");
        const result = await response.json();
        const code = text(result.countryCode).toUpperCase();
        const nearby = {area: text(result.locality), city: text(result.city), state: text(result.principalSubdivision), countryCode: countryName(code) ? code : undefined};
        const found = Boolean(nearby.area || nearby.city || nearby.state || nearby.countryCode);
        finish(found ? "ready" : "unavailable", found ? nearby : null);
      } catch {
        finish("unavailable");
      }
    }, (error) => finish(error.code === 1 ? "denied" : "unavailable"), {
      enableHighAccuracy: false, timeout: 9000, maximumAge: 300_000,
    });
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let stored: {status?: Status; place?: Place | null} | null = null;
    try { stored = JSON.parse(sessionStorage.getItem(cacheKey) ?? "null"); } catch {}
    if (stored?.status === "ready" && stored.place) {
      setPlace(stored.place);
      setStatus("ready");
    } else if (stored?.status === "denied" || stored?.status === "unavailable") {
      setStatus(stored.status);
    } else {
      locate();
    }
  }, [locate]);

  return <LocationContext.Provider value={{place, status, locate}}>{children}</LocationContext.Provider>;
}

export function useSiteLocation() {
  return useContext(LocationContext);
}

export function SiteLocationLabel({locale}: {locale: string}) {
  const {place, status, locate} = useSiteLocation();
  const router = useRouter();
  const menu = useRef<HTMLDetailsElement>(null);
  const name = [...new Set([place?.area, place?.city || place?.state, countryName(place?.countryCode)].filter(Boolean))].join(", ");
  const label = name || (status === "loading" ? "Finding location…" : "Choose location");

  function browse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query = new URLSearchParams();
    const country = String(form.get("country") ?? "");
    const city = String(form.get("city") ?? "").trim();
    if (country) query.set("country", country);
    if (city) query.set("city", city);
    if (menu.current) menu.current.open = false;
    router.push(`/${locale}/properties${query.size ? `?${query}` : ""}`);
  }

  return <details className="market-popover market-location-menu" name="marketplace-header-menus" ref={menu}>
    <summary className="market-location" title={label} aria-label={name ? `Choose location. Current location: ${name}` : "Choose location"}>
      <MapPin size={16} aria-hidden="true" /><span aria-live="polite">{label}</span><ChevronDown size={13} aria-hidden="true" />
    </summary>
    <div className="market-popover-menu market-location-panel">
      <button type="button" onClick={locate} disabled={status === "loading"}><LocateFixed size={16} aria-hidden="true" />Use my location</button>
      {status === "denied" && <p>Allow location in your browser settings to use your current position.</p>}
      <form onSubmit={browse}>
        <label>Country or territory<select name="country" defaultValue="">
          <option value="">All countries</option>
          {listingCountries.map(({label: countryLabel, value}) => <option key={value} value={value}>{countryLabel}</option>)}
        </select></label>
        <label>City or area<input name="city" type="search" maxLength={80} placeholder="Enter a city or area" /></label>
        <button className="market-button" type="submit"><Search size={15} aria-hidden="true" />Browse properties</button>
      </form>
    </div>
  </details>;
}
