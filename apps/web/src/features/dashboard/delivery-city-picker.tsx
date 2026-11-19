import {useEffect, useId, useState, type ComponentProps} from "react";
import {Plus, X} from "lucide-react";
import type {DeliveryCity} from "@the-property-pillar/contracts";
import {defaultListingCountry, listingCountries} from "@/config/listing-geography";
import {apiRequest} from "@/lib/api/client";
import styles from "./dashboard.module.css";

export function DeliveryCityPicker({label, country, selected, multiple = false, legacy = [], onChange, ...fieldProps}: {
  label: string;
  country: string;
  selected: DeliveryCity[];
  multiple?: boolean;
  legacy?: string[];
  onChange: (cities: DeliveryCity[]) => void;
} & Pick<ComponentProps<"input">, "name" | "aria-invalid" | "aria-describedby">) {
  const [searchCountry, setSearchCountry] = useState(country || defaultListingCountry);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(false);
  const [results, setResults] = useState<{key: string; cities: DeliveryCity[]; failed?: boolean}>();
  const [attempt, setAttempt] = useState(0);
  const inputId = useId();
  const code = multiple ? searchCountry : country;
  const term = query.trim();
  const key = `${code}-${term}-${attempt}`;

  useEffect(() => {
    if (!active || !code || term.length < 2) return;
    const controller = new AbortController();
    const params = new URLSearchParams({country: code, q: term});
    const timer = window.setTimeout(() => {
      apiRequest<DeliveryCity[]>(`/locations/delivery-cities?${params}`, {signal: controller.signal})
        .then((cities) => {if (!controller.signal.aborted) setResults({key, cities});})
        .catch(() => {if (!controller.signal.aborted) setResults({key, cities: [], failed: true});});
    }, 200);
    return () => {window.clearTimeout(timer); controller.abort();};
  }, [active, code, key, term]);

  const ready = results?.key === key ? results : undefined;
  const candidates = (ready?.cities ?? []).filter((city) => !selected.some(({id}) => id === city.id));
  const limitReached = multiple && selected.length >= 50;
  const selectedDescription = (city: DeliveryCity) => [city.name, city.region && city.region !== city.name ? city.region : "", city.countryCode].filter(Boolean).join(", ");

  return <div className={styles.cityPicker}>
    {multiple && <label className={styles.field}>
      <span>Search country</span>
      <select value={searchCountry} onChange={(event) => {setSearchCountry(event.target.value); setQuery("");}}>
        {listingCountries.map(({value, label}) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>}
    <label className={styles.field} htmlFor={inputId}>
      <span>{label}</span>
      <input {...fieldProps} id={inputId} type="search" autoComplete="off"
        disabled={!code || limitReached} maxLength={120}
        placeholder={!code ? "Select a country first" : limitReached ? "50 delivery cities selected" : "Search by city name"}
        value={query} onChange={(event) => {setQuery(event.target.value); setActive(true);}}
        onFocus={() => setActive(true)}
        onKeyDown={(event) => {if (event.key === "Enter") event.preventDefault();}}
      />
    </label>
    {active && term.length >= 2 && code && !limitReached && <div className={styles.cityMatches}>
      {!ready ? <small role="status">Searching cities…</small> : ready.failed ? (
        <button className={styles.secondaryButton} type="button" onClick={() => setAttempt((value) => value + 1)}>Retry city search</button>
      ) : candidates.length ? <ul aria-label="Matching cities">
        {candidates.map((city) => <li key={city.id}>
          <button type="button" onClick={() => {onChange(multiple ? [...selected, city] : [city]); setQuery("");}}>
            <Plus size={15} aria-hidden="true" /> {selectedDescription(city)}
          </button>
        </li>)}
      </ul> : <small role="status">No matching cities in this country. Check the spelling or try a nearby delivery city.</small>}
    </div>}
    {!!selected.length && <ul className={styles.citySelections} aria-label={label + " selected"}>
      {selected.map((city) => <li key={city.id}>
        <span>{selectedDescription(city)}</span>
        <button type="button" aria-label={`Remove ${selectedDescription(city)}`} onClick={() => onChange(selected.filter(({id}) => city.id !== id))}>
          <X size={14} aria-hidden="true" />
        </button>
      </li>)}
    </ul>}
    {!selected.length && legacy.length > 0 && <small>Previously saved: {legacy.join(", ")}. Select a catalog city to update this location.</small>}
  </div>;
}
