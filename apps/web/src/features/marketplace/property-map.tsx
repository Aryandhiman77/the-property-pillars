"use client";

import {useEffect, useState, type FormEvent} from "react";
import {LockKeyhole, MapPin, ArrowUpRight} from "lucide-react";
import {ApiClientError, apiRequest} from "@/lib/api/client";
import {Button} from "@/components/ui/button";
import {PhoneInput, formPhone} from "@/components/ui/phone-input";
import {useMarketplaceAuth} from "@/features/auth/marketplace-session";
import {leadVisitorTypes, type LeadVisitorType} from "@the-property-pillar/contracts";
import {useMobilePrompt, VisitorOptions} from "@/features/auth/mobile-auth";
import styles from "./property-map.module.css";

export type MapPinValue = {latitude: number; longitude: number; sourceUrl?: string};

export function MapFrame({pin}: {pin: MapPinValue}) {
  const {latitude, longitude} = pin;
  const clip = (value: number, max: number) => Math.max(-max, Math.min(max, value));
  const bbox = [clip(longitude - .005, 180), clip(latitude - .003, 90), clip(longitude + .005, 180), clip(latitude + .003, 90)].join(",");
  const src = "https://www.openstreetmap.org/export/embed.html?" + new URLSearchParams({bbox, layer: "mapnik", marker: latitude + "," + longitude});
  return <iframe className={styles.frame} title="Property location map" src={src} referrerPolicy="no-referrer" loading="lazy" />;
}

export function MapPinInput({value, error, onChange}: {value: MapPinValue | null; error?: string; onChange: (pin: MapPinValue | null) => void}) {
  const [link, setLink] = useState(value?.sourceUrl ?? "");
  const [latitude, setLatitude] = useState(value?.latitude.toString() ?? "");
  const [longitude, setLongitude] = useState(value?.longitude.toString() ?? "");
  const [preview, setPreview] = useState<MapPinValue | null>(value);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function resolve() {
    setLoading(true);
    setMessage("");
    try {
      const pin = await apiRequest<MapPinValue>("/workspace/property-map/resolve", {method: "POST", body: {url: link}});
      setLatitude(String(pin.latitude)); setLongitude(String(pin.longitude)); setPreview(pin);
    } catch (failure) {setMessage(failure instanceof Error ? failure.message : "Could not read the map link.");}
    finally {setLoading(false);}
  }
  function confirm() {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      setMessage("Enter a valid latitude and longitude.");
      return;
    }
    const pin = {latitude: lat, longitude: lng, sourceUrl: preview?.latitude === lat && preview.longitude === lng ? preview.sourceUrl : undefined};
    setPreview(pin); onChange(pin); setMessage("");
  }
  return <fieldset className={styles.pinInput}>
    <legend>Property map</legend>
    <small>A saved map pin helps locate nearby places for this listing.</small>
    <label>Map link<input type="url" value={link} placeholder="Google Maps or OpenStreetMap pin link" onChange={(event) => {setLink(event.target.value); setPreview(null);}} /></label>
    <Button type="button" variant="outline" disabled={!link.trim() || loading} onClick={() => void resolve()}>{loading ? "Finding pin…" : "Preview link pin"}</Button>
    <div className={styles.coords}>
      <label>Latitude<input inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} /></label>
      <label>Longitude<input inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} /></label>
    </div>
    <div className={styles.actions}>
      <Button type="button" variant="outline" disabled={loading} onClick={confirm}>Use this pin</Button>
      {value && <Button type="button" variant="outline" onClick={() => {onChange(null); setPreview(null); setLink(""); setLatitude(""); setLongitude("");}}>Remove pin</Button>}
    </div>
    {(message || error) && <small className={styles.error} role="alert">{message || error}</small>}
    {preview && <MapFrame pin={preview} />}
    {value && <small>Saved pin for this form: {value.latitude}, {value.longitude}</small>}
  </fieldset>;
}

export function PropertyMap({id}: {id: string}) {
  const auth = useMarketplaceAuth();
  const signedIn = Boolean(auth?.session);
  return <section className={styles.map} aria-label="Property location">
    <h2><MapPin aria-hidden="true" size={21} /> Property location</h2>
    {auth?.state === "loading" ? <p role="status">Checking map access…</p>
      : auth?.state === "error" ? <><p role="status">Map access could not be checked.</p><Button type="button" variant="outline" onClick={() => void auth.refresh()}>Retry</Button></>
        : <MapAccess key={`${id}:${signedIn}`} id={id} signedIn={signedIn} refreshAuth={auth?.refresh} />}
  </section>;
}

function MapAccess({id, signedIn, refreshAuth}: {id: string; signedIn: boolean; refreshAuth?: () => Promise<void>}) {
  const path = "/public/properties/" + encodeURIComponent(id) + "/map";
  const [pin, setPin] = useState<MapPinValue | null>(null);
  const [status, setStatus] = useState<"loading" | "locked" | "unavailable" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mobile = useMobilePrompt();
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<MapPinValue>(path, {signal: controller.signal}).then((data) => {if (!controller.signal.aborted) setPin(data);}, (error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof ApiClientError && error.status === 403 && !signedIn) setStatus("locked");
      else if (error instanceof ApiClientError && error.status === 404) setStatus("unavailable");
      else setStatus("error");
    });
    return () => controller.abort();
  }, [path, retry, signedIn]);
  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const fullName = String(data.get("fullName") ?? "").trim();
    const phone = formPhone(data);
    const visitorType = data.get("visitorType") as LeadVisitorType;
    const consent = data.has("consent");
    const invalid: Record<string, string> = {};
    if (fullName.length < 2) invalid.fullName = "Enter your full name.";
    if (!/^\+[\d\s().-]{7,25}$/.test(phone)) invalid.phone = "Enter your mobile number with the country code.";
    if (!leadVisitorTypes.includes(visitorType)) invalid.visitorType = "Choose an option.";
    if (!consent) invalid.consent = "Confirm that your details can be shared with the property poster.";
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    setBusy(true);
    try {
      if (!verified) {
        if (!await mobile.verify({scope: "map:" + id, identity: {fullName, phone, visitorType}})) return;
        setVerified(true);
      }
      setPin(await apiRequest<MapPinValue>(path + "/unlock", {method: "POST", body: {consent}}));
      void refreshAuth?.();
    }
    catch (failure) {
      setErrors(failure instanceof ApiClientError && Object.keys(failure.fieldErrors).length ? failure.fieldErrors :
        {general: failure instanceof Error ? failure.message : "The map could not be unlocked."});
    } finally {setBusy(false);}
  }
  const fieldError = (name: string) => errors[name] && <small id={"map-" + name} role="alert" className={styles.error}>{errors[name]}</small>;
  if (pin) return <><MapFrame pin={pin} /><a href={"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(pin.latitude + "," + pin.longitude)} target="_blank" rel="noopener noreferrer">Open in Google Maps <ArrowUpRight size={15} aria-hidden="true" /></a></>;
  if (status === "loading") return <p role="status">Loading property map…</p>;
  if (status === "unavailable") return <p role="status">This property map is unavailable.</p>;
  if (status === "error" || signedIn) return <><p role="status">Could not load the property map.</p><Button type="button" variant="outline" onClick={() => {
    if (signedIn && refreshAuth) void refreshAuth();
    else {setStatus("loading"); setRetry((value) => value + 1);}
  }}>Retry map</Button></>;
  return <><div className={styles.locked}><LockKeyhole aria-hidden="true" size={29} /><strong>Exact location locked</strong></div>
      {!open ? <Button type="button" onClick={() => setOpen(true)}>Unlock map</Button> : <form onSubmit={unlock} noValidate className={styles.form}>
        <div className={styles.field}><label htmlFor="map-lead-name">Full name</label><input id="map-lead-name" name="fullName" autoComplete="name" maxLength={100} required aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? "map-fullName" : undefined} />{fieldError("fullName")}</div>
        <div className={styles.field}><label htmlFor="map-lead-phone">Mobile number</label><PhoneInput id="map-lead-phone" name="phone" required placeholder="Mobile number" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "map-phone" : undefined} />{fieldError("phone")}</div>
        <label>Which best describes you?<select name="visitorType" defaultValue="" required aria-invalid={!!errors.visitorType} aria-describedby={errors.visitorType ? "map-visitorType" : undefined}>
          <VisitorOptions /></select>{fieldError("visitorType")}</label>
        <div><label><input type="checkbox" name="consent" required aria-describedby={errors.consent ? "map-consent" : undefined} /> Share my details with this property’s poster.</label>{fieldError("consent")}</div>
        {fieldError("general")}
        <Button type="submit" disabled={busy}>{busy ? "Unlocking…" : "Submit and unlock map"}</Button>
      </form>}{mobile.dialog}</>;
}
