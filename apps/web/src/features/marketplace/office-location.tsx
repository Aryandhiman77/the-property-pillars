import {safeHttpUrl} from "@/lib/image-source";
import css from "./advertiser-profile.module.css";

export type BusinessOffice = {address?:string|null; registered?:boolean; mapUrl?:string; embed?:string; coordinates?:number[]};
export function OfficeLocation({office,name}:{office?:BusinessOffice;name:string}) {
  const coords = office?.coordinates;
  const pin = coords?.length === 2 && coords.every(Number.isFinite) ? coords.join(",") : "";
  const officeQuery = pin || office?.address;
  const mapLink = safeHttpUrl(office?.mapUrl) || (officeQuery ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(officeQuery) : "");
  const embed = office?.embed && /^https:\/\/(?:www\.|maps\.)?google\.com\/maps(?:\/embed\?|\?)/.test(office.embed) ? office.embed :
    officeQuery ? "https://maps.google.com/maps?output=embed&z=17&q=" + encodeURIComponent(officeQuery) : "";
  if (!office?.address && !mapLink && !embed) return null;
  return <section className={css.panel}>
            <h2>{office?.registered ? "Registered office" : "Office location"}</h2>
            {office?.address && <address>{office.address}</address>}
            {embed && <iframe className={css.officeMap} loading="lazy" title={name + " office map"} src={embed} referrerPolicy="strict-origin-when-cross-origin"/>}
            {mapLink && <a href={mapLink} target="_blank" rel="noopener noreferrer">Open office in Google Maps</a>}
          </section>;
}
