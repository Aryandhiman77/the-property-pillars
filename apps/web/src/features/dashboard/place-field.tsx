"use client";

import {MaterialInput, MaterialSelect} from "@/components/ui/material-fields";

import {useEffect, useId, useState, type ComponentProps} from "react";
import {apiRequest} from "@/lib/api/client";

type PlaceOption = {id: string; name: string; region?: string};

export function PlaceField({kind, country, region, city, value, onChange, ...attrs}: {
  kind: "state" | "city" | "locality";
  country: string;
  region: string;
  city: string;
  value: string;
  onChange: (value: string, option?: PlaceOption) => void;
} & Pick<ComponentProps<"input">, "aria-invalid" | "aria-describedby" | "name" | "required">) {
  const id = useId();
  const [options, setOptions] = useState<PlaceOption[]>([]);
  const [active, setActive] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const disabled = !country || (kind === "city" && country === "IN" && !region) || (kind === "locality" && !city);
  useEffect(() => {
    if ((!active && kind !== "state") || disabled) return;
    const abort = new AbortController();
    const params = new URLSearchParams({country, kind, q: kind === "state" ? "" : value});
    if (kind === "city" && region) params.set("state", region);
    if (kind === "locality") {
      if (!/^\d+$/.test(city)) return;
      params.set("cityId", city);
    }
    const timer = window.setTimeout(() => {
      void apiRequest<PlaceOption[]>("/locations/places?" + params, {signal: abort.signal}).then((items) => {
        if (!abort.signal.aborted) {setOptions(items); setUnavailable(false);}
      }, () => {if (!abort.signal.aborted) {setOptions([]); setUnavailable(true);}});
    }, 180);
    return () => {abort.abort(); window.clearTimeout(timer);};
  }, [country, kind, region, city, value, active, disabled]);

  if (kind === "state") {
    return <MaterialSelect {...attrs} value={value} disabled={disabled} onFocus={() => setActive(true)} onPointerDown={() => setActive(true)}
      onChange={(event) => onChange(event.target.value)}>
      <option value="">Choose region</option>
      {value && !options.some(({name}) => name === value) && <option value={value}>{value}</option>}
      {options.map(({id: key, name}) => <option key={key} value={name}>{name}</option>)}
      {unavailable && <option disabled>Location options are temporarily unavailable</option>}
    </MaterialSelect>;
  }
  return <>
    <MaterialInput {...attrs} value={value} list={id} disabled={disabled} maxLength={kind === "city" ? 120 : 160}
      placeholder={kind === "city" ? "Search or enter city" : "Choose or enter area"} onFocus={() => setActive(true)}
      onChange={(event) => {
        const name = event.target.value;
        onChange(name, options.find((option) => option.name.toLowerCase() === name.trim().toLowerCase()));
      }} />
    <datalist id={id}>{options.map(({id: key, name}) => <option key={key} value={name} />)}</datalist>
    {unavailable && <small>Suggestions unavailable. You can enter the name.</small>}
  </>;
}
